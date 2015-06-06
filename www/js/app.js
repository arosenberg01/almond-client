// Ionic Starter App

// angular.module is a global place for creating, registering and retrieving Angular modules
// 'starter' is the name of this angular module example (also set in a <body> attribute in index.html)
// the 2nd parameter is an array of 'requires'
// 'starter.controllers' is found in controllers.js
angular.module('almond', ['ionic', 'almond.controllers', 'angularMoment', 'ion-google-place'])

.run(function($ionicPlatform, $rootScope, userLocation) {
  $ionicPlatform.ready(function() {
    // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
    // for form inputs)
    if (window.cordova && window.cordova.plugins.Keyboard) {
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);
    }
    if (window.StatusBar) {
      // org.apache.cordova.statusbar required
      StatusBar.styleDefault();
    }

    function setRootScope(key,val) {
      $rootScope[key] = val;
    }

    function updateLoc() {
      userLocation.getCoords().then(function(coords){
        setRootScope('userLat',coords.latitude);
        setRootScope('userLong',coords.longitude);
        setRootScope('userAccuracy',coords.accuracy);
      });
    }
    updateLoc();
    setInterval(updateLoc,5000);
  });
})

.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider

  .state('app', {
    url: "/app",
    abstract: true,
    templateUrl: "templates/menu.html",
    controller: 'AppCtrl'
  })

  .state('app.start', {
    url: "/start",
    views: {
      'menuContent': {
        templateUrl: "templates/start.html",
        controller: 'StartCtrl'
      }
    }
  })
  
  .state('app.travelModes', {
    url: "/travelModes",
    views: {
      'menuContent': {
        templateUrl: "templates/travelModes.html",
        controller: 'TravelModesCtrl'
      }
    }
  })

  .state('app.travelMode', {
    url: "/travelMode/{travelMode}",
    views: {
      'menuContent': {
        templateUrl: "templates/travelMode.html",
        controller: 'TravelModeCtrl'
      }
    }
  })

  .state('app.map', {
    url: "/map",
    views: {
      'menuContent': {
        templateUrl: "templates/map.html",
        controller: 'MapCtrl'
      }
    }
  })

  .state('app.settings', {
    url: "/settings",
    views: {
      'menuContent': {
        templateUrl: "templates/settings.html",
        controller: 'SettingsCtrl'
      }
    }
  });
  // if none of the above states are matched, use this as the fallback
  $urlRouterProvider.otherwise('/app/start');
})

.directive('reverseGeocode', function () {
    return {
        restrict: 'E',
        template: '<span>Locating...</span>',
        link: function (scope, element, attrs) {
            var geocoder = new google.maps.Geocoder();
            var latlng = new google.maps.LatLng(attrs.lat, attrs.lng);
            geocoder.geocode({ 'latLng': latlng }, function (results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    if (results[1]) {
                        element.text(
                          results[0].address_components.filter(function(v){
                            if(
                                v.types.indexOf('street_number') !== -1 ||
                                v.types.indexOf('route') !== -1 // ||
                                // v.types.indexOf('neighborhood') !== -1 ||
                                // v.types.indexOf('sublocality_level_1') !== -1
                                ) { return true; }
                            else { return false };
                          })
                          .map(function(v){
                              return v.long_name;
                          })
                          .join(" ")
                          );
                    } else {
                        element.text('Location not found');
                    }
                } else {
                    element.text('Geocoder failed due to: ' + status);
                }
            });
        },
        replace: true
    }
})
.constant('angularMomentConfig', {
    preprocess: 'unix' // optional
})
.factory('userLocation', function($q, $rootScope) {
  return {
    getCoords: function() {
      var deferred = $q.defer();
      navigator.geolocation.getCurrentPosition(function(pos) {
        $rootScope.$broadcast('UserLocation.Update');
        deferred.resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        })
      },function(error) {
        deferred.reject("Geolocation API didn't return coordinates :(");
        if(error.code && error.message) {
          console.warn('GPS error ' + error.code + ": " + error.message);
        } else {
            console.warn("GPS error: No error message. Error object below.");
            console.dir(error);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      });
    return deferred.promise;
    }
  };
})

.factory('destinationService', function ($rootScope) {
  'use strict';
  var dest;

  var broadcast = function (dest) {
    $rootScope.$broadcast('Destination.Update', dest);
    console.log('destinationService: broadcasted')
  };

  var update = function (newDest) {
    console.log("previous value: " + dest)
    dest = newDest;
    broadcast(dest);
    console.log('destinationService: updated, new value is ' + newDest);
  };
  
  var listen = function ($scope, callback) {
    $scope.$on('Destination.Update', function (newDest) {
      console.log("destinationService: caught Update event")
      callback(newDest);
    });
    console.log('destinationService: listened')
  };

  var get = function () {
    return dest;
  }

  return {
    update: update,
    listen: listen,
    get: get
  };
})

.filter('shortenTime',function(){
  return function(str) {
    console.log("shortenTime-ing: " + str)
    str = str.replace(/ mins/g,'m');
    str = str.replace(/ min/g,'m');
    return str;
  };
})

.service('mapService',function(){
  var map, userMarker, accuracyCircle;
  var create = function(id,lat,lng) {
    lat = lat || 37.7483;
    lng = lng || -122.4367;
    map = new google.maps.Map(document.getElementById(id), {
      center: new google.maps.LatLng(lat,lng),
      zoom: 12,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      disableDefaultUI: true,
      styles: [{ featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }]}]
    });
    return map;
  };

  var drawRoute = function(sLat,sLng,endStr) {
    var directionsService = new google.maps.DirectionsService();
    var start = new google.maps.LatLng(sLat, sLng);
    var end = endStr;
    var directionsDisplay = new google.maps.DirectionsRenderer();// also, constructor can get "DirectionsRendererOptions" object
    directionsDisplay.setMap(map); // map should be already initialized.

    var directionsService = new google.maps.DirectionsService(); 
    directionsService.route({
      origin : start,
      destination : end,
      travelMode : google.maps.TravelMode.DRIVING
    }, function(response, status) {
      if (status == google.maps.DirectionsStatus.OK) {
        directionsDisplay.setDirections(response);
      }
    });
  };

  var updateUserLocation = function(lat,lng,accuracy) {
    if(typeof userMarker === 'undefined') {
      userMarker = new google.maps.Marker({
        position: new google.maps.LatLng(lat,lng),
        map: map,
        title: "My Location",
        clickable: false,
        icon: {
                url: 'img/currentLocation.png',
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(25, 25),
                scaledSize: new google.maps.Size(50, 50)
              }
      });
      accuracyCircle = new google.maps.Circle({
        map: map,
        radius: accuracy,    // 10 miles in metres
        fillColor: '#add8e6',
        fillOpacity: 0.66,
        strokeColor: '#3A9FBF',
        strokeWeight: 1
      });
      accuracyCircle.bindTo('center', userMarker, 'position');
    } else {
      userMarker.setPosition(new google.maps.LatLng(lat, lng));
      accuracyCircle.setCenter(new google.maps.LatLng(lat, lng));
      accuracyCircle.setRadius(accuracy);
    }
  };
  return {
    updateUserLocation: updateUserLocation,
    create: create,
    drawRoute: drawRoute
  }
})
;