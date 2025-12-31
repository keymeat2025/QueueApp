/**
 * QueueApp Archive Manager
 * Handles daily cleanup, archival, and auto-split logic
 * Version: 2.0 - Monthly Archives with Auto-Split
 */

const ArchiveManager = {
  /**
   * Check if we should use the new archive system
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {boolean}
   */
  useNewSystem(date) {
    const month = date.slice(0, 7); // YYYY-MM
    return month >= '2026-01'; // January 2026 onwards
  },

  /**
   * Calculate size of data in bytes
   * @param {object} data - Data to measure
   * @returns {number}
   */
  getDataSize(data) {
    return new Blob([JSON.stringify(data)]).size;
  },

  /**
   * Check if data exceeds safe size (900KB)
   * @param {object} data - Data to check
   * @returns {boolean}
   */
  exceedsSafeSize(data) {
    const maxSafeSize = 900 * 1024; // 900KB (leave 100KB buffer)
    return this.getDataSize(data) > maxSafeSize;
  },

  /**
   * Prepare archive data from queue
   * @param {array} queue - Queue array
   * @param {string} date - Date string
   * @param {string} cleanupType - 'manual' or 'auto'
   * @returns {object}
   */
  prepareArchiveData(queue, date, cleanupType) {
    const customers = queue.map(c => ({
      queueNumber: c.queueNumber,
      name: c.name,
      phone: c.phone,
      guests: c.guests,
      joinedAt: c.joinedAt,
      allocatedAt: c.allocatedAt || null,
      tableNo: c.tableNo || null,
      status: c.status
    }));

    return {
      date: date,
      summary: {
        totalCustomers: queue.length,
        served: queue.filter(q => q.status === 'allocated').length,
        waiting: queue.filter(q => q.status === 'waiting').length
      },
      customers: customers,
      archivedAt: new Date().toISOString(),
      cleanupType: cleanupType
    };
  },

  /**
   * Split customers into parts for localStorage
   * @param {array} customers - Customer array
   * @param {string} rid - Restaurant ID
   * @param {string} date - Date string
   * @param {object} restaurant - Restaurant object
   */
  splitAndStoreLocalStorage(customers, rid, date, restaurant) {
    const maxCustomersPerPart = Math.floor((900 * 1024) / 200); // ~4500 customers
    let partNumber = 1;
    let offset = 0;

    while (offset < customers.length) {
      const chunk = customers.slice(offset, offset + maxCustomersPerPart);
      const hasMore = (offset + maxCustomersPerPart) < customers.length;

      const partKey = partNumber === 1 
        ? `archive_${rid}_${date}` 
        : `archive_${rid}_${date}_part${partNumber}`;

      const partData = {
        restaurantId: rid,
        restaurantName: restaurant.name,
        date: date,
        partNumber: partNumber,
        totalParts: Math.ceil(customers.length / maxCustomersPerPart),
        summary: {
          totalCustomers: chunk.length,
          totalInAllParts: customers.length,
          served: chunk.filter(c => c.status === 'allocated').length,
          waiting: chunk.filter(c => c.status === 'waiting').length
        },
        customers: chunk,
        hasMoreParts: hasMore,
        nextPart: hasMore ? `archive_${rid}_${date}_part${partNumber + 1}` : null
      };

      localStorage.setItem(partKey, JSON.stringify(partData));

      offset += maxCustomersPerPart;
      partNumber++;
    }
  },

  /**
   * Store archive in old system (queueArchive field)
   * @param {object} restaurant - Restaurant object
   * @param {object} archiveData - Archive data
   * @param {string} date - Date string
   */
  storeOldSystem(restaurant, archiveData, date) {
    const qa = restaurant.queueArchive || {};
    qa[date] = archiveData;
    restaurant.queueArchive = qa;
  },

  /**
   * Store archive in new system (separate localStorage entries)
   * @param {string} rid - Restaurant ID
   * @param {object} restaurant - Restaurant object
   * @param {object} archiveData - Archive data
   * @param {string} date - Date string
   */
  storeNewSystem(rid, restaurant, archiveData, date) {
    const customers = archiveData.customers;

    if (this.exceedsSafeSize(archiveData)) {
      // Auto-split into parts
      this.splitAndStoreLocalStorage(customers, rid, date, restaurant);
    } else {
      // Normal case - single document
      const archiveKey = `archive_${rid}_${date}`;
      const archiveContent = {
        restaurantId: rid,
        restaurantName: restaurant.name,
        date: date,
        summary: archiveData.summary,
        customers: archiveData.customers,
        archivedAt: archiveData.archivedAt,
        hasMoreParts: false
      };
      localStorage.setItem(archiveKey, JSON.stringify(archiveContent));
    }
  },

  /**
   * Split customers into parts for Firestore
   * @param {object} transaction - Firestore transaction
   * @param {object} db - Firestore database
   * @param {array} customers - Customer array
   * @param {string} rid - Restaurant ID
   * @param {string} date - Date string
   * @param {object} restaurant - Restaurant data
   */
  splitAndStoreFirestore(transaction, db, customers, rid, date, restaurant) {
    const maxCustomersPerPart = Math.floor((900 * 1024) / 200);
    let partNumber = 1;
    let offset = 0;

    while (offset < customers.length) {
      const chunk = customers.slice(offset, offset + maxCustomersPerPart);
      const hasMore = (offset + maxCustomersPerPart) < customers.length;

      const partDocId = partNumber === 1 
        ? `${rid}-${date}` 
        : `${rid}-${date}-part${partNumber}`;

      const partData = {
        restaurantId: rid,
        restaurantName: restaurant.name,
        date: date,
        partNumber: partNumber,
        totalParts: Math.ceil(customers.length / maxCustomersPerPart),
        summary: {
          totalCustomers: chunk.length,
          totalInAllParts: customers.length,
          served: chunk.filter(c => c.status === 'allocated').length,
          waiting: chunk.filter(c => c.status === 'waiting').length
        },
        customers: chunk,
        hasMoreParts: hasMore,
        nextPart: hasMore ? `${rid}-${date}-part${partNumber + 1}` : null,
        archivedAt: new Date().toISOString(),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      transaction.set(db.collection('archives').doc(partDocId), partData);

      offset += maxCustomersPerPart;
      partNumber++;
    }
  },

  /**
   * Store archive in Firestore (new system)
   * @param {object} transaction - Firestore transaction
   * @param {object} db - Firestore database
   * @param {string} rid - Restaurant ID
   * @param {object} restaurant - Restaurant data
   * @param {object} archiveData - Archive data
   * @param {string} date - Date string
   */
  storeFirestoreNewSystem(transaction, db, rid, restaurant, archiveData, date) {
    const customers = archiveData.customers;

    if (this.exceedsSafeSize(archiveData)) {
      // Auto-split into multiple Firestore documents
      this.splitAndStoreFirestore(transaction, db, customers, rid, date, restaurant);
    } else {
      // Normal case - single Firestore document
      const archiveRef = db.collection('archives').doc(`${rid}-${date}`);

      const archiveContent = {
        restaurantId: rid,
        restaurantName: restaurant.name,
        date: date,
        summary: archiveData.summary,
        customers: archiveData.customers,
        archivedAt: archiveData.archivedAt,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        hasMoreParts: false
      };

      transaction.set(archiveRef, archiveContent);
    }
  },

  /**
   * Store archive in Firestore (old system - queueArchive field)
   * @param {object} transaction - Firestore transaction
   * @param {object} restaurantRef - Restaurant document reference
   * @param {object} restaurant - Restaurant data
   * @param {object} archiveData - Archive data
   * @param {string} date - Date string
   */
  storeFirestoreOldSystem(transaction, restaurantRef, restaurant, archiveData, date) {
    const qa = restaurant.queueArchive || {};
    qa[date] = archiveData;
    transaction.update(restaurantRef, {
      queue: [],
      queueArchive: qa,
      lastCleanupDate: date,
      lastCleanup: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  /**
   * Read archives from localStorage (supports both old and new systems)
   * @param {string} rid - Restaurant ID
   * @param {object} restaurant - Restaurant object (for old system)
   * @returns {array} - Array of all customers from archives
   */
  readLocalStorageArchives(rid, restaurant) {
    let allCustomers = [];

    // 1. OLD SYSTEM: queueArchive field
    if (restaurant.queueArchive) {
      Object.keys(restaurant.queueArchive).forEach(date => {
        const archive = restaurant.queueArchive[date];
        if (archive.customers && Array.isArray(archive.customers)) {
          archive.customers.forEach(c => {
            allCustomers.push({
              ...c,
              _fromArchive: true,
              _archiveDate: date,
              _archiveSource: 'old'
            });
          });
        }
      });
    }

    // 2. NEW SYSTEM: Separate localStorage entries
    // Scan localStorage for archive entries
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`archive_${rid}_`)) {
        try {
          const archiveData = JSON.parse(localStorage.getItem(key));
          if (archiveData && archiveData.customers) {
            archiveData.customers.forEach(c => {
              allCustomers.push({
                ...c,
                _fromArchive: true,
                _archiveDate: archiveData.date,
                _archiveSource: 'new',
                _archivePart: archiveData.partNumber || 1
              });
            });
          }
        } catch (err) {
          console.error('Error parsing archive:', key, err);
        }
      }
    }

    return allCustomers;
  },

  /**
   * Read archives from Firestore (supports multi-part archives)
   * @param {object} db - Firestore database
   * @param {string} rid - Restaurant ID
   * @returns {Promise<array>} - Array of all customers from archives
   */
  async readFirestoreArchives(db, rid) {
    let allCustomers = [];

    try {
      const archivesSnapshot = await db.collection('archives')
        .where('restaurantId', '==', rid)
        .get();

      if (!archivesSnapshot.empty) {
        archivesSnapshot.docs.forEach(doc => {
          const archive = doc.data();

          if (archive.customers && Array.isArray(archive.customers)) {
            archive.customers.forEach(c => {
              allCustomers.push({
                ...c,
                _fromArchive: true,
                _archiveDate: archive.date,
                _archiveSource: 'firestore',
                _archivePart: archive.partNumber || 1
              });
            });
          }
        });
      }
    } catch (error) {
      console.error('Error loading Firestore archives:', error);
    }

    return allCustomers;
  }
};

// Export for use in index.html
window.ArchiveManager = ArchiveManager;
