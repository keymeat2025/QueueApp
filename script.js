$(document).ready(function() {
  function showLiveLocation(inputId, liveLocationId) {
    const liveLocation = $(`#${liveLocationId}`);
    liveLocation.show();
    liveLocation.text('Fetching live location...');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        const lat = position.coords.latitude;
        const long = position.coords.longitude;
        liveLocation.html(`Latitude: ${lat}, Longitude: ${long} <br> <button onclick="pinLocation('${inputId}', ${lat}, ${long})">Pin Location</button>`);
      }, function() {
        liveLocation.text('Unable to fetch location');
      });
    } else {
      liveLocation.text('Geolocation is not supported by this browser.');
    }
  }

  function pinLocation(inputId, lat, long) {
    $(`#${inputId}`).val(`Lat: ${lat}, Long: ${long}`);
    $(`#${inputId}-live-location`).hide();
  }

  // Show live location on focus
  $('#pickup').on('focus', function() {
    showLiveLocation('pickup', 'pickup-live-location');
  });

  $('#dropoff').on('focus', function() {
    showLiveLocation('dropoff', 'dropoff-live-location');
  });

  // Autocomplete for dropoff location
  $("#dropoff").autocomplete({
    source: function(request, response) {
      $.ajax({
        url: "https://api.locationiq.com/v1/autocomplete.php",
        data: {
          key: "pk.3ff92f87d4bd491b6a78884f21390cf7",
          q: request.term,
          format: "json"
        },
        success: function(data) {
          response($.map(data, function(item) {
            return {
              label: item.display_name,
              value: item.display_name
            };
          }));
        }
      });
    },
    minLength: 2,
    select: function(event, ui) {
      $("#dropoff").val(ui.item.label);
      $("#clear-dropoff").show();
      return false;
    }
  });

  // Show and hide clear button for dropoff location
  $("#clear-dropoff").click(function() {
    $("#dropoff").val('');
    $(this).hide();
  });

  $("#dropoff").on('input', function() {
    if ($(this).val() === '') {
      $("#clear-dropoff").hide();
    } else {
      $("#clear-dropoff").show();
    }
  });

  // Show and hide clear button for pickup location
  $("#clear-pickup").click(function() {
    $("#pickup").val('');
    $(this).hide();
  });

  $("#pickup").on('input', function() {
    if ($(this).val() === '') {
      $("#clear-pickup").hide();
    } else {
      $("#clear-pickup").show();
    }
  });

  document.getElementById('trip-form').addEventListener('submit', function(event) {
    event.preventDefault();
    const pickup = document.getElementById('pickup').value;
    const dropoff = document.getElementById('dropoff').value;
    const datetime = document.getElementById('datetime').value;

    // Add your booking logic here
    alert(`Trip booked from ${pickup} to ${dropoff} at ${datetime}`);
  });

  function scheduleLater() {
    alert('Trip scheduled for later');
  }

  let selectedField = '';

  function openLocationModal(locationType) {
    var modal = document.getElementById("locationModal");
    modal.style.display = "block";
    // Additional code to handle the locationType and map setup
  }

  function closeModal() {
    document.getElementById('locationModal').style.display = 'none';
  }

  function useCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(position) {
        const userLocation = [position.coords.longitude, position.coords.latitude];
        // Set the map to user location and update the selected field
        document.getElementById(selectedField).value = 'Current Location'; // Update with actual location name
        closeModal();
      });
    } else {
      alert('Geolocation is not supported by this browser.');
    }
  }

  function confirmLocation() {
    // Get the selected location from the map and update the selected field
    document.getElementById(selectedField).value = 'Selected Location'; // Update with actual location name
    closeModal();
  }

  // Expose functions to global scope
  window.openLocationModal = openLocationModal;
  window.closeModal = closeModal;
  window.useCurrentLocation = useCurrentLocation;
  window.confirmLocation = confirmLocation;
});
