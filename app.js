// Initial icon size (will be scaled based on zoom)
var defaultIconSize = 16;

// Define a function to calculate icon size based on zoom level
function calculateIconSize(zoom) {
    return defaultIconSize * Math.pow(1.2, zoom - 12);  // Scale the icon size based on zoom
}

// Define function to create marker icons dynamically
function createStationIcon(isCollected, zoom) {
    var iconSize = calculateIconSize(zoom);
    return L.divIcon({
        html: `
            <div style="text-align:center;">
                <img src="${isCollected ? 'full-radio.png' : 'empty-radio.png'}" width="${iconSize}" height="${iconSize}">
            </div>`,
        iconAnchor: [iconSize / 2, iconSize],  // Anchor the icon to the bottom center
        className: '',  // Clear default Leaflet styling
        iconSize: [iconSize, iconSize]
    });
}

// Create the Leaflet map and center it around the Imperial Palace in Tokyo
var map = L.map('map').setView([35.682839, 139.759455], 13);  // Centered around the Imperial Palace

// Tile layer options
// osm = "https://a.tile.openstreetmap.org/",
// carto_light = "https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/",
// carto_dark = "https://cartodb-basemaps-a.global.ssl.fastly.net/dark_all/"

// Use CartoDB light tiles for the base map
L.tileLayer('https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
}).addTo(map);

// Variable to store all markers
var markers = [];
var stationNames = new Set(); // To track unique station names
var maxDisplayedMarkers = 300; // Maximum number of markers to display

// Create a search bar element
var searchBar = L.control({ position: 'topright' });
searchBar.onAdd = function() {
    var div = L.DomUtil.create('div', 'search-bar');
    div.innerHTML = '<input type="text" id="stationSearch" placeholder="Search for a station...">';
    return div;
};
searchBar.addTo(map);

// Handle search functionality
document.getElementById('stationSearch').addEventListener('keyup', function(event) {
    var searchTerm = event.target.value.toLowerCase();
    var filteredMarkers = markers.filter(marker => {
        return marker.getPopup().getContent().toLowerCase().includes(searchTerm);
    });

    // Center the map on the first matching marker if available
    if (filteredMarkers.length > 0) {
        map.setView(filteredMarkers[0].getLatLng(), 13); // Center the map on the first matching marker
    }

    // Load filtered markers
    loadFilteredMarkers(filteredMarkers);
});

// Fetch the station data from stations.json
fetch('stations.json')
    .then(response => response.json())
    .then(data => {
        // Store markers but don't add them to the map yet
        data.forEach(stationGroup => {
            stationGroup.stations.forEach(station => {
                var stationCode = station.code;

                // Check if the station belongs to the excluded line code
                if (station.line_code === "TokyoMetro.MarunouchiBranch" || station.line_code === "TokyoMetro.Marunouchi") {
                    return; // Skip this station
                }

                // Truncate the station.code to exclude the line_code value
                var stationName = stationCode.split('.').pop(); // Get the last part after the last dot

                // Check if the station name is a duplicate
                if (stationNames.has(stationName)) {
                    return; // Skip this duplicate station
                }
                stationNames.add(stationName); // Add to the set of unique station names

                var lat = station.lat;
                var lon = station.lon;

                // Check if the station is already collected from localStorage
                var isCollected = localStorage.getItem(stationName) === "true";

                // Create the marker icon
                var stationMarker = L.marker([lat, lon], {
                    icon: createStationIcon(isCollected, map.getZoom())  // Use initial zoom to set size
                });

                // Add mouseover and mouseout events to display and hide the popup
                stationMarker.on('mouseover', function() {
                    stationMarker.bindPopup(stationName, { offset: L.point(0, -10) }).openPopup(); // Show the station name above the icon
                });

                stationMarker.on('mouseout', function() {
                    stationMarker.closePopup(); // Hide the popup when not hovering
                });

                // Add click event listener to toggle between collected and uncollected
                stationMarker.on('click', function() {
                    // Toggle collected state
                    isCollected = !isCollected;  // Toggle the collected state

                    if (isCollected) {
                        localStorage.setItem(stationName, "true"); // Mark as collected
                    } else {
                        localStorage.setItem(stationName, "false"); // Mark as uncollected
                    }
                    stationMarker.setIcon(createStationIcon(isCollected, map.getZoom())); // Update the icon
                });

                // Store the marker in the markers array
                markers.push(stationMarker);
            });
        });

        // Check if markers are within the visible map bounds
        loadMarkersInView();

        // Add event listener to load markers when the map is moved or zoomed
        map.on('moveend', loadMarkersInView);
        map.on('zoomend', updateMarkerSizes);  // Update icon size on zoom change
    })
    .catch(error => console.error('Error fetching the stations data:', error));

// Function to load filtered markers based on search
function loadFilteredMarkers(filteredMarkers) {
    // Clear all markers from the map
    markers.forEach(marker => {
        if (map.hasLayer(marker)) {
            map.removeLayer(marker);
        }
    });

    // Add the filtered markers to the map
    var markersToDisplay = filteredMarkers.slice(0, maxDisplayedMarkers); // Limit to maxDisplayedMarkers
    markersToDisplay.forEach(marker => {
        marker.addTo(map);
    });
}

// Function to check if a marker is within the map's visible bounds
function loadMarkersInView() {
    var bounds = map.getBounds();  // Get the current visible bounds of the map

    // Arrays to hold collected and unchecked markers
    var collectedMarkers = [];
    var uncheckedMarkers = [];

    // Separate markers into collected and unchecked based on their visibility
    markers.forEach(marker => {
        if (bounds.contains(marker.getLatLng())) {
            if (marker.getIcon().options.html.includes('full-radio.png')) {
                collectedMarkers.push(marker); // Add to collected markers if collected
            } else {
                uncheckedMarkers.push(marker); // Add to unchecked markers
            }
        }
    });

    // Combine collected and unchecked markers, limiting the total displayed
    var markersToDisplay = collectedMarkers.concat(uncheckedMarkers).slice(0, maxDisplayedMarkers);

    // Add only the markers to the map that are within bounds
    markers.forEach(marker => {
        if (markersToDisplay.includes(marker)) {
            if (!map.hasLayer(marker)) {
                marker.addTo(map);  // Add the marker to the map if it's within the bounds
            }
        } else {
            if (map.hasLayer(marker)) {
                map.removeLayer(marker);  // Remove the marker if it's outside the bounds
            }
        }
    });
}

// Function to update marker sizes dynamically based on zoom level
function updateMarkerSizes() {
    var zoom = map.getZoom();  // Get the current zoom level
    markers.forEach(marker => {
        var isCollected = localStorage.getItem(marker.getPopup().getContent()) === "true";  // Check if station is collected
        marker.setIcon(createStationIcon(isCollected, zoom));  // Update the marker size
    });
}
