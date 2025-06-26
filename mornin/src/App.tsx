import React, { useState, useEffect, useRef } from 'react';
import { Clock, MapPin, Cloud, User, Bell, Sun, Moon, CloudRain, Search, Map, Navigation, Sparkles, Coffee, Bed, Car, X, ChevronRight, Loader2, Droplets, Wind, CloudSnow, Calendar } from 'lucide-react';

// Global window type extension - must be at file level
declare global {
  interface Window {
    H: any;
  }
}

// Type definitions
interface AddressSuggestion {
  title: string;
  position?: {
    lat: number;
    lng: number;
  };
  address?: {
    label: string;
    street?: string;
    houseNumber?: string;
    city?: string;
    state?: string;
    country?: string;
  };
}

interface Settings {
  classTime: string;
  destination: string;
  destinationCoords: { lat: number; lng: number } | null;
  getReadyTime: number;
  personType: string;
  bufferTime: number;
}

interface WeatherData {
  condition: string;
  temp: number;
  feelsLike: number;
  precipitation: number;
  cloudCoverage: number;
  humidity: number;
  description: string;
}

interface TrafficData {
  delay: number;
  condition: string;
  totalTime?: number;
  baseTime?: number;
  route?: any;
  error?: string;
}

interface Results {
  classTime: string;
  wakeUpTime: string;
  firstAlarmTime: string;
  snoozes: number;
  isNextDay: boolean;
  breakdown: {
    getReady: number;
    commute: number;
    trafficDelay: number;
    weatherDelay: number;
    buffer: number;
    personalBuffer: number;
    snoozeTime: number;
  };
}

interface UserLocation {
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  country?: string;
}

const MorningCalculator = () => {
  const [settings, setSettings] = useState<Settings>({
    classTime: '08:00',
    destination: '',
    destinationCoords: null,
    getReadyTime: 30,
    personType: 'normal',
    bufferTime: 10
  });

  const [results, setResults] = useState<Results | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // API Configuration - Use environment variables for security
  const apiKeys = {
    weather: process.env.REACT_APP_WEATHER_API_KEY || 'c5b866ecee2d1647c5472b0322d6c08c',
    hereAppId: process.env.REACT_APP_HERE_APP_ID || 'CGdQabamBZVD4GhTYIjm',
    hereApiKey: process.env.REACT_APP_HERE_API_KEY || 'ub9mmoHcVMzP2Edf0-1xp617AhdLt0dNpARLxSKuOTg'
  };

  const [wakeUpWeatherData, setWakeUpWeatherData] = useState<WeatherData>({
    condition: 'clear',
    temp: 72,
    feelsLike: 70,
    precipitation: 0,
    cloudCoverage: 15,
    humidity: 50,
    description: 'Clear morning'
  });

  const [trafficData, setTrafficData] = useState<TrafficData>({
    delay: 0,
    condition: 'light'
  });

  const [animationClass, setAnimationClass] = useState('');
  const [showRouteMap, setShowRouteMap] = useState(false);
  const routeMapRef = useRef<any>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    getUserLocation();
    loadHereMaps();
    return () => clearInterval(timer);
  }, []);

  // Load HERE Maps SDK
  const loadHereMaps = () => {
    if (!window.H) {
      const script1 = document.createElement('script');
      script1.src = 'https://js.api.here.com/v3/3.1/mapsjs-core.js';
      script1.type = 'text/javascript';
      document.head.appendChild(script1);

      script1.onload = () => {
        const script2 = document.createElement('script');
        script2.src = 'https://js.api.here.com/v3/3.1/mapsjs-service.js';
        script2.type = 'text/javascript';
        document.head.appendChild(script2);

        script2.onload = () => {
          const script3 = document.createElement('script');
          script3.src = 'https://js.api.here.com/v3/3.1/mapsjs-ui.js';
          script3.type = 'text/javascript';
          document.head.appendChild(script3);

          script3.onload = () => {
            const script4 = document.createElement('script');
            script4.src = 'https://js.api.here.com/v3/3.1/mapsjs-mapevents.js';
            script4.type = 'text/javascript';
            document.head.appendChild(script4);
          };
        };
      };
    }
  };

  // Initialize map when modal opens
  useEffect(() => {
    if (showMapModal && userLocation && window.H) {
      setTimeout(() => {
        initializeMap();
      }, 100);
    }
  }, [showMapModal, userLocation]);

  const initializeMap = () => {
    if (!userLocation || !window.H) return;

    const platform = new window.H.service.Platform({
      'apikey': apiKeys.hereApiKey
    });

    const defaultLayers = platform.createDefaultLayers();
    const mapContainer = document.getElementById('map-container');
    
    if (!mapContainer) return;

    const map = new window.H.Map(
      mapContainer,
      defaultLayers.vector.normal.map,
      {
        zoom: 14,
        center: { lat: userLocation.lat, lng: userLocation.lng }
      }
    );

    const behavior = new window.H.mapevents.Behavior(new window.H.mapevents.MapEvents(map));
    const ui = window.H.ui.UI.createDefault(map, defaultLayers);

    // Add marker for selected location
    const marker = new window.H.map.Marker({ lat: userLocation.lat, lng: userLocation.lng });
    map.addObject(marker);
    markerRef.current = marker;

    // Add click event to select location
    map.addEventListener('tap', (evt: any) => {
      const coord = map.screenToGeo(evt.currentPointer.viewportX, evt.currentPointer.viewportY);
      
      // Update marker position
      if (markerRef.current) {
        map.removeObject(markerRef.current);
      }
      
      const newMarker = new window.H.map.Marker(coord);
      map.addObject(newMarker);
      markerRef.current = newMarker;

      // Reverse geocode to get address
      reverseGeocode(coord.lat, coord.lng);
    });

    mapRef.current = map;
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://revgeocode.search.hereapi.com/v1/revgeocode?at=${lat},${lng}&lang=en-US&apikey=${apiKeys.hereApiKey}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          const item = data.items[0];
          setSettings({
            ...settings,
            destination: item.address.label,
            destinationCoords: { lat, lng }
          });
        }
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }
  };

  // Get user's location and city
  const getUserLocation = async () => {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true
        });
      });
      
      const { latitude, longitude } = position.coords;
      
      // Reverse geocode to get city and state
      const response = await fetch(
        `https://revgeocode.search.hereapi.com/v1/revgeocode?at=${latitude},${longitude}&lang=en-US&apikey=${apiKeys.hereApiKey}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.items && data.items.length > 0) {
          const address = data.items[0].address;
          setUserLocation({
            lat: latitude,
            lng: longitude,
            city: address.city,
            state: address.state,
            country: address.countryCode
          });
        }
      }
    } catch (error) {
      console.error('Location error:', error);
      // Default to a city if geolocation fails
      setUserLocation({
        lat: 29.7604,
        lng: -95.3698,
        city: 'Houston',
        state: 'Texas',
        country: 'USA'
      });
    }
  };

  const personTypes: Record<string, { snoozes: number; extraBuffer: number; label: string; emoji: string }> = {
    'heavy-sleeper': { snoozes: 3, extraBuffer: 15, label: 'Heavy Sleeper', emoji: '😴' },
    'normal': { snoozes: 1, extraBuffer: 5, label: 'Normal Sleeper', emoji: '😊' },
    'light-sleeper': { snoozes: 0, extraBuffer: 0, label: 'Light Sleeper', emoji: '😌' },
    'always-late': { snoozes: 2, extraBuffer: 20, label: 'Always Late', emoji: '😅' }
  };

  // Format address for better display
  const formatAddress = (item: AddressSuggestion): string => {
    if (item.address) {
      const { houseNumber, street, city, state } = item.address;
      const parts = [];
      
      // Build address starting with house number and street
      if (houseNumber && street) {
        parts.push(`${houseNumber} ${street}`);
      } else if (street) {
        parts.push(street);
      }
      
      // Add city and state
      if (city) parts.push(city);
      if (state) parts.push(state);
      
      return parts.join(', ');
    }
    return item.title;
  };

  // Address autocomplete with local preference
  const searchAddresses = async (query: string) => {
    if (query.length < 2) {  // Changed from 3 to 2
      setAddressSuggestions([]);
      return;
    }

    try {
      let searchQuery = query;
      // Add city/state context if available and not already in query
      if (userLocation && userLocation.city && !query.toLowerCase().includes(userLocation.city.toLowerCase())) {
        searchQuery = `${query} ${userLocation.city} ${userLocation.state}`;
      }

      const response = await fetch(
        `https://autocomplete.search.hereapi.com/v1/autocomplete?q=${encodeURIComponent(searchQuery)}&limit=5&at=${userLocation?.lat || 0},${userLocation?.lng || 0}&apikey=${apiKeys.hereApiKey}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setAddressSuggestions(data.items || []);
      }
    } catch (error) {
      console.error('Address search error:', error);
    }
  };

  const handleAddressChange = (value: string) => {
    setSettings({...settings, destination: value});
    setShowSuggestions(true);
    
    // Debounce address search
    const timeoutId = setTimeout(() => {
      searchAddresses(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const selectAddress = (item: AddressSuggestion) => {
    setSettings({
      ...settings, 
      destination: formatAddress(item),
      destinationCoords: item.position || null
    });
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  // Check if arrival time is for next day
  const isArrivalTimeNextDay = (arrivalTime: string): boolean => {
    const now = new Date();
    const [hours, minutes] = arrivalTime.split(':').map(Number);
    const arrivalDate = new Date();
    arrivalDate.setHours(hours, minutes, 0, 0);
    
    return arrivalDate.getTime() <= now.getTime();
  };

  // Fetch weather for wake-up time
  const fetchWakeUpWeatherData = async (wakeUpTime: string, isNextDay: boolean): Promise<WeatherData> => {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true
        });
      });
      
      const { latitude, longitude } = position.coords;
      
      // Calculate hours until wake up
      const now = new Date();
      const [hours, minutes] = wakeUpTime.split(':').map(Number);
      const wakeUpDate = new Date();
      wakeUpDate.setHours(hours, minutes, 0, 0);
      
      if (isNextDay) {
        wakeUpDate.setDate(wakeUpDate.getDate() + 1);
      }
      
      const hoursUntilWakeUp = Math.ceil((wakeUpDate.getTime() - now.getTime()) / (1000 * 60 * 60));
      
      // Use forecast API for future weather
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKeys.weather}&units=imperial&cnt=${Math.min(hoursUntilWakeUp, 40)}`
      );
      
      if (!response.ok) throw new Error('Weather forecast API failed');
      
      const data = await response.json();
      
      // Find the forecast closest to wake-up time
      const targetTime = wakeUpDate.getTime();
      const closestForecast = data.list.reduce((closest: any, forecast: any) => {
        const forecastTime = forecast.dt * 1000;
        const closestTime = closest.dt * 1000;
        
        return Math.abs(forecastTime - targetTime) < Math.abs(closestTime - targetTime) 
          ? forecast : closest;
      });
      
      return {
        condition: closestForecast.weather[0].main.toLowerCase(),
        temp: Math.round(closestForecast.main.temp),
        feelsLike: Math.round(closestForecast.main.feels_like),
        precipitation: closestForecast.rain ? (closestForecast.rain['3h'] || 0) : 
                      (closestForecast.snow ? (closestForecast.snow['3h'] || 0) : 0),
        cloudCoverage: closestForecast.clouds.all,
        humidity: closestForecast.main.humidity,
        description: closestForecast.weather[0].description
      };
    } catch (error) {
      console.error('Wake-up weather API error:', error);
      return wakeUpWeatherData;
    }
  };

  const fetchTrafficData = async (): Promise<TrafficData> => {
    if (!settings.destination.trim()) {
      return { delay: 0, condition: 'light', error: 'No destination set' };
    }
    
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true
        });
      });
      
      const { latitude, longitude } = position.coords;
      let destCoords = settings.destinationCoords;
      
      // If no coordinates saved, geocode the address
      if (!destCoords) {
        const geocodeResponse = await fetch(
          `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(settings.destination)}&apikey=${apiKeys.hereApiKey}`
        );
        
        if (!geocodeResponse.ok) throw new Error('Geocoding failed');
        
        const geocodeData = await geocodeResponse.json();
        
        if (!geocodeData.items || geocodeData.items.length === 0) {
          throw new Error('Destination not found');
        }
        
        destCoords = geocodeData.items[0].position;
      }
      
      // TypeScript null check - destCoords should be defined at this point
      if (!destCoords) {
        throw new Error('Could not determine destination coordinates');
      }
      
      const routeResponse = await fetch(
        `https://router.hereapi.com/v8/routes?transportMode=car&origin=${latitude},${longitude}&destination=${destCoords.lat},${destCoords.lng}&return=summary,travelSummary&departureTime=${new Date().toISOString()}&apikey=${apiKeys.hereApiKey}`
      );
      
      if (!routeResponse.ok) throw new Error('Routing API failed');
      
      const routeData = await routeResponse.json();
      
      if (!routeData.routes || routeData.routes.length === 0) {
        throw new Error('No route found');
      }
      
      const route = routeData.routes[0];
      const travelTimeMinutes = Math.round(route.sections[0].travelSummary.duration / 60);
      const baseTimeMinutes = Math.round(route.sections[0].travelSummary.baseDuration / 60);
      const trafficDelay = Math.max(0, travelTimeMinutes - baseTimeMinutes);
      
      return {
        delay: trafficDelay,
        condition: trafficDelay > 10 ? 'heavy' : trafficDelay > 5 ? 'moderate' : 'light',
        totalTime: travelTimeMinutes,
        baseTime: baseTimeMinutes,
        route: route
      };
      
    } catch (error) {
      console.error('Traffic API error:', error);
      return { delay: 0, condition: 'light', error: (error as Error).message };
    }
  };

  const calculateWakeUpTime = async () => {
    setIsCalculating(true);
    setShowResults(false);
    setAnimationClass('animate-pulse');
    
    // Check if arrival time is next day
    const isNextDay = isArrivalTimeNextDay(settings.classTime);
    
    // Fetch real-time data
    const currentTraffic = await fetchTrafficData();
    
    setTrafficData(currentTraffic);
    
    const classTimeMinutes = timeToMinutes(settings.classTime);
    const commuteTime = currentTraffic.totalTime || 25; // Use total time from traffic API
    const weatherDelay = 0; // Will be calculated based on wake-up weather
    const personTypeData = personTypes[settings.personType];
    
    const totalPreparationTime = 
      settings.getReadyTime + 
      commuteTime + 
      weatherDelay + 
      settings.bufferTime + 
      personTypeData.extraBuffer;

    const wakeUpTimeMinutes = classTimeMinutes - totalPreparationTime;
    const snoozeTime = personTypeData.snoozes * 9;
    const actualWakeUpTime = wakeUpTimeMinutes - snoozeTime;

    // Handle negative wake up time (crosses midnight)
    let adjustedWakeUpTime = actualWakeUpTime;
    if (actualWakeUpTime < 0) {
      adjustedWakeUpTime = 24 * 60 + actualWakeUpTime;
    }

    const wakeUpTimeString = minutesToTime(adjustedWakeUpTime);
    
    // Fetch weather for wake-up time
    const wakeUpWeather = await fetchWakeUpWeatherData(wakeUpTimeString, isNextDay || actualWakeUpTime < 0);
    setWakeUpWeatherData(wakeUpWeather);

    // Recalculate with weather delay
    const actualWeatherDelay = wakeUpWeather.precipitation > 0 ? 5 : 0;
    const totalPrepWithWeather = totalPreparationTime + actualWeatherDelay;
    const finalWakeUpMinutes = classTimeMinutes - totalPrepWithWeather - snoozeTime;
    let finalAdjustedWakeUp = finalWakeUpMinutes;
    if (finalWakeUpMinutes < 0) {
      finalAdjustedWakeUp = 24 * 60 + finalWakeUpMinutes;
    }

    const breakdown = {
      classTime: settings.classTime,
      wakeUpTime: minutesToTime(finalAdjustedWakeUp),
      firstAlarmTime: minutesToTime((classTimeMinutes - totalPrepWithWeather < 0) ? 24 * 60 + classTimeMinutes - totalPrepWithWeather : classTimeMinutes - totalPrepWithWeather),
      snoozes: personTypeData.snoozes,
      isNextDay: isNextDay,
      breakdown: {
        getReady: settings.getReadyTime,
        commute: currentTraffic.baseTime || 25,
        trafficDelay: currentTraffic.delay,
        weatherDelay: actualWeatherDelay,
        buffer: settings.bufferTime,
        personalBuffer: personTypeData.extraBuffer,
        snoozeTime
      }
    };

    setResults(breakdown);
    setIsCalculating(false);
    setShowResults(true);
    setAnimationClass('animate-bounce');
    
    // Show route on map if we have route data
    if (currentTraffic.route) {
      setTimeout(() => {
        setShowRouteMap(true);
        setTimeout(() => {
          displayRouteOnMap(currentTraffic.route);
        }, 300);
      }, 500);
    }
    
    setTimeout(() => setAnimationClass(''), 1000);
  };

  // Display route on map
  const displayRouteOnMap = (routeData: any) => {
    if (!window.H || !routeData) return;

    const platform = new window.H.service.Platform({
      'apikey': apiKeys.hereApiKey
    });

    const defaultLayers = platform.createDefaultLayers();
    const mapContainer = document.getElementById('route-map-container');
    
    if (!mapContainer) return;

    const routeMap = new window.H.Map(
      mapContainer,
      defaultLayers.vector.normal.map,
      {
        zoom: 10,
        center: { lat: userLocation?.lat || 0, lng: userLocation?.lng || 0 }
      }
    );

    const behavior = new window.H.mapevents.Behavior(new window.H.mapevents.MapEvents(routeMap));
    const ui = window.H.ui.UI.createDefault(routeMap, defaultLayers);

    // Create line string from route
    const route = routeData.routes[0];
    const lineString = new window.H.geo.LineString();
    
    route.sections[0].polyline.split(',').forEach((coord: string, index: number) => {
      if (index % 2 === 0 && route.sections[0].polyline.split(',')[index + 1]) {
        lineString.pushPoint({
          lat: parseFloat(coord),
          lng: parseFloat(route.sections[0].polyline.split(',')[index + 1])
        });
      }
    });

    // Create polyline
    const routeLine = new window.H.map.Polyline(lineString, {
      style: {
        strokeColor: 'rgba(147, 51, 234, 0.8)',
        lineWidth: 6
      }
    });

    // Add the route to the map
    routeMap.addObject(routeLine);

    // Add markers for start and end
    const startMarker = new window.H.map.Marker({
      lat: userLocation?.lat || 0,
      lng: userLocation?.lng || 0
    });
    
    const endMarker = new window.H.map.Marker({
      lat: settings.destinationCoords?.lat || 0,
      lng: settings.destinationCoords?.lng || 0
    });

    routeMap.addObjects([startMarker, endMarker]);

    // Zoom to show the entire route
    routeMap.getViewModel().setLookAtData({
      bounds: routeLine.getBoundingBox()
    });

    routeMapRef.current = routeMap;
  };

  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes: number): string => {
    const hours24 = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    const hours12 = hours24 % 12 || 12;
    const ampm = hours24 < 12 ? 'AM' : 'PM';
    return `${hours12}:${mins.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatTime12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const hours12 = hours % 12 || 12;
    const ampm = hours < 12 ? 'AM' : 'PM';
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const getWeatherIcon = (condition: string) => {
    switch(condition) {
      case 'sunny':
      case 'clear': return <Sun className="w-10 h-10 text-yellow-400" />;
      case 'rain':
      case 'drizzle': return <CloudRain className="w-10 h-10 text-blue-400" />;
      case 'snow': return <CloudSnow className="w-10 h-10 text-blue-200" />;
      case 'clouds':
      case 'cloudy': return <Cloud className="w-10 h-10 text-gray-300" />;
      default: return <Cloud className="w-10 h-10 text-gray-300" />;
    }
  };

  const getTrafficColor = () => {
    switch(trafficData.condition) {
      case 'light': return 'text-green-400';
      case 'moderate': return 'text-yellow-400';
      case 'heavy': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 5) return { text: "Still awake?", emoji: "🌙" };
    if (hour < 12) return { text: "Good morning!", emoji: "☀️" };
    if (hour < 17) return { text: "Good afternoon!", emoji: "🌤️" };
    if (hour < 22) return { text: "Good evening!", emoji: "🌆" };
    return { text: "Night owl?", emoji: "🦉" };
  };

  const greeting = getGreeting();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-4 transition-all duration-500">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-blue-500 rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-purple-500 rounded-full filter blur-3xl opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-pink-500 rounded-full filter blur-3xl opacity-10 animate-pulse delay-2000"></div>
      </div>

      <div className="max-w-md mx-auto relative">
        {/* Header */}
        <div className="text-center mb-8 pt-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-6 py-3 rounded-full mb-4">
            <span className="text-2xl">{greeting.emoji}</span>
            <span className="text-white/90 font-medium">{greeting.text}</span>
          </div>
          
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <Sparkles className="w-8 h-8 text-yellow-300 animate-pulse" />
            Morning Calculator
            <Sparkles className="w-8 h-8 text-yellow-300 animate-pulse" />
          </h1>
          <p className="text-white/80 text-lg">Wake up perfectly on time, every time</p>
          
          <div className="mt-6 relative">
            <div className="text-white/90 text-5xl font-bold font-mono tracking-wider">
              {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit', hour12: true})}
            </div>
            <div className="text-white/60 text-sm mt-1">
              {currentTime.toLocaleDateString([], {weekday: 'long', month: 'long', day: 'numeric'})}
            </div>
          </div>
        </div>

        {/* Settings Card */}
        <div className={`bg-white/10 backdrop-blur-lg rounded-3xl p-6 mb-6 border border-white/20 transform transition-all duration-500 ${animationClass}`}>
          <h2 className="text-2xl font-semibold text-white mb-6 flex items-center justify-center gap-2">
            <User className="w-6 h-6" />
            Your Morning Setup
          </h2>
          
          <div className="space-y-5">
            {/* Arrival Time - Enhanced */}
            <div className="transform hover:scale-[1.02] transition-all duration-200">
              <label className="block text-white/80 text-sm mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                When do you need to arrive?
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={settings.classTime}
                  onChange={(e) => setSettings({...settings, classTime: e.target.value})}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-4 text-white placeholder-white/60 focus:bg-white/20 focus:border-white/40 transition-all duration-200 text-xl font-medium"
                  style={{ colorScheme: 'dark' }}
                />
                {isArrivalTimeNextDay(settings.classTime) && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-yellow-300 text-sm flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Tomorrow
                  </div>
                )}
              </div>
            </div>

            {/* Destination */}
            <div className="relative transform hover:scale-[1.02] transition-all duration-200">
              <label className="block text-white/80 text-sm mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Where are you going?
              </label>
              <div className="relative">
                <input
                  ref={addressInputRef}
                  type="text"
                  placeholder={`Enter destination in ${userLocation?.city || 'your city'}...`}
                  value={settings.destination}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-24 text-white placeholder-white/60 focus:bg-white/20 focus:border-white/40 transition-all duration-200"
                />
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-2">
                  <button
                    type="button"
                    className="p-2 text-white/60 hover:text-white transition-colors duration-200"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMapModal(true)}
                    className="p-2 text-white/60 hover:text-white bg-white/10 rounded-lg hover:bg-white/20 transition-all duration-200"
                  >
                    <Map className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Address Suggestions Dropdown - Fixed for better interaction */}
              {showSuggestions && addressSuggestions.length > 0 && (
                <div 
                  className="absolute z-50 w-full mt-2 bg-gray-900 border border-purple-500/50 rounded-xl overflow-hidden shadow-2xl"
                  onMouseDown={(e) => e.preventDefault()} // Prevent blur on click
                >
                  {addressSuggestions.map((item, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        selectAddress(item);
                        addressInputRef.current?.focus();
                      }}
                      className="w-full text-left px-4 py-3 text-white bg-gray-900 hover:bg-purple-700 transition-all duration-200 border-b border-purple-500/20 last:border-0"
                    >
                      <div className="font-medium flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-purple-400 flex-shrink-0" />
                        <span className="text-white truncate">{formatAddress(item)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              <div className="text-white/60 text-xs mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Starting from your current location
              </div>
            </div>

            {/* Get Ready Time */}
            <div className="transform hover:scale-[1.02] transition-all duration-200">
              <label className="block text-white/80 text-sm mb-2 flex items-center gap-2">
                <Coffee className="w-4 h-4" />
                How long to get ready? (min)
              </label>
              <input
                type="number"
                value={settings.getReadyTime}
                onChange={(e) => setSettings({...settings, getReadyTime: parseInt(e.target.value) || 0})}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:bg-white/20 focus:border-white/40 transition-all duration-200"
              />
            </div>

            {/* Person Type - Enhanced UI */}
            <div className="transform hover:scale-[1.02] transition-all duration-200">
              <label className="block text-white/80 text-sm mb-3 flex items-center gap-2">
                <Bed className="w-4 h-4" />
                What type of sleeper are you?
              </label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(personTypes).map(([key, type]) => (
                  <button
                    key={key}
                    onClick={() => setSettings({...settings, personType: key})}
                    className={`p-4 rounded-xl border transition-all duration-200 ${
                      settings.personType === key
                        ? 'bg-white/20 border-white/40 scale-105 shadow-lg'
                        : 'bg-white/5 border-white/20 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-2xl mb-1">{type.emoji}</div>
                    <div className="text-white text-sm font-medium">{type.label}</div>
                    <div className="text-white/60 text-xs mt-1">
                      {type.snoozes} snooze{type.snoozes !== 1 ? 's' : ''}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Buffer Time */}
            <div className="transform hover:scale-[1.02] transition-all duration-200">
              <label className="block text-white/80 text-sm mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Extra buffer time (min)
              </label>
              <input
                type="number"
                value={settings.bufferTime}
                onChange={(e) => setSettings({...settings, bufferTime: parseInt(e.target.value) || 0})}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:bg-white/20 focus:border-white/40 transition-all duration-200"
              />
            </div>
          </div>

          <button
            onClick={calculateWakeUpTime}
            disabled={isCalculating || !settings.destination.trim()}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:from-gray-600 disabled:to-gray-700 rounded-2xl py-5 mt-8 text-white font-bold text-lg transition-all duration-300 flex items-center justify-center gap-3 transform hover:scale-[1.02] disabled:scale-100 shadow-xl hover:shadow-2xl disabled:shadow-md"
          >
            {isCalculating ? (
              <>
                <Loader2 className="w-6 h-6 animate-spin" />
                <span>Calculating your perfect wake-up time...</span>
              </>
            ) : (
              <>
                <Bell className="w-6 h-6" />
                <span>Calculate My Wake Up Time</span>
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </button>
        </div>

        {/* Results Card - With Traffic Info and Wake-up Weather */}
        {showResults && results && (
          <div className="space-y-6 animate-fade-in">
            {/* Wake-up Weather - Only shows after calculation */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 transform hover:scale-[1.02] transition-all duration-300">
              <h3 className="text-white/80 text-sm mb-3 text-center font-medium">Weather at Wake-up Time</h3>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  {getWeatherIcon(wakeUpWeatherData.condition)}
                  <div className="text-white/70 text-sm capitalize mt-1">{wakeUpWeatherData.description}</div>
                </div>
                
                <div className="space-y-2 text-right">
                  <div className="text-white">
                    <span className="text-3xl font-bold">{wakeUpWeatherData.temp}°</span>
                    <span className="text-lg opacity-80">F</span>
                  </div>
                  <div className="text-white/70 text-sm">Feels like {wakeUpWeatherData.feelsLike}°</div>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20">
                <div className="text-center">
                  <Droplets className="w-5 h-5 text-blue-300 mx-auto mb-1" />
                  <div className="text-white/90 text-sm font-medium">{wakeUpWeatherData.precipitation}%</div>
                  <div className="text-white/60 text-xs">Precip</div>
                </div>
                <div className="text-center">
                  <Cloud className="w-5 h-5 text-gray-300 mx-auto mb-1" />
                  <div className="text-white/90 text-sm font-medium">{wakeUpWeatherData.cloudCoverage}%</div>
                  <div className="text-white/60 text-xs">Clouds</div>
                </div>
                <div className="text-center">
                  <Wind className="w-5 h-5 text-white/70 mx-auto mb-1" />
                  <div className="text-white/90 text-sm font-medium">{wakeUpWeatherData.humidity}%</div>
                  <div className="text-white/60 text-xs">Humidity</div>
                </div>
              </div>
            </div>

            {/* Traffic Info - Only shows after calculation */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-5 border border-white/20 transform hover:scale-[1.02] transition-all duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl bg-white/10 ${getTrafficColor()}`}>
                    <Navigation className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-lg">Traffic Conditions</div>
                    <div className="text-white/70 text-sm capitalize">{trafficData.condition} traffic</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white font-bold text-2xl">{trafficData.totalTime}min</div>
                  <div className="text-white/60 text-sm">+{trafficData.delay}min delay</div>
                </div>
              </div>
              {trafficData.error && (
                <div className="text-red-300 text-sm mt-3 p-2 bg-red-500/20 rounded-lg">
                  ⚠️ {trafficData.error}
                </div>
              )}
            </div>

            {/* Main Results */}
            <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-lg rounded-3xl p-8 border border-white/30 shadow-2xl transform hover:scale-[1.01] transition-all duration-500">
              <h2 className="text-2xl font-bold text-white mb-6 text-center flex items-center justify-center gap-2">
                <Sparkles className="w-6 h-6 text-yellow-300" />
                Your Perfect Schedule
                <Sparkles className="w-6 h-6 text-yellow-300" />
              </h2>
              
              <div className="space-y-6">
                {/* Wake Up Time - Hero Display */}
                <div className="bg-gradient-to-r from-green-400/30 to-blue-500/30 rounded-2xl p-8 border border-white/30 text-center transform hover:scale-105 transition-all duration-300">
                  <div className="text-6xl font-bold text-white mb-3 animate-pulse">
                    {results.wakeUpTime}
                  </div>
                  <div className="text-white/90 text-xl font-medium">Wake Up Time</div>
                  {results.isNextDay && (
                    <div className="text-yellow-300 text-sm mt-2 flex items-center justify-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Tomorrow's arrival</span>
                    </div>
                  )}
                  {results.snoozes > 0 && (
                    <div className="text-white/70 text-sm mt-3 bg-white/10 rounded-full px-4 py-2 inline-block">
                      ⏰ First alarm: {results.firstAlarmTime} ({results.snoozes} snooze{results.snoozes !== 1 ? 's' : ''})
                    </div>
                  )}
                </div>

                {/* Time Breakdown */}
                <div className="bg-white/10 rounded-2xl p-6 space-y-3">
                  <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Time Breakdown
                  </h3>
                  
                  {[
                    { icon: <Coffee className="w-4 h-4" />, label: 'Getting ready', value: results.breakdown.getReady },
                    { icon: <Car className="w-4 h-4" />, label: 'Normal commute', value: results.breakdown.commute },
                    { icon: <Navigation className="w-4 h-4" />, label: 'Traffic delay', value: `+${results.breakdown.trafficDelay}`, highlight: true },
                    ...(results.breakdown.weatherDelay > 0 ? [{ icon: <CloudRain className="w-4 h-4" />, label: 'Weather delay', value: `+${results.breakdown.weatherDelay}` }] : []),
                    { icon: <Clock className="w-4 h-4" />, label: 'Buffer time', value: results.breakdown.buffer },
                    { icon: <User className="w-4 h-4" />, label: 'Personal buffer', value: results.breakdown.personalBuffer },
                    ...(results.breakdown.snoozeTime > 0 ? [{ icon: <Bell className="w-4 h-4" />, label: 'Snooze time', value: results.breakdown.snoozeTime }] : [])
                  ].map((item, index) => (
                    <div 
                      key={item.label} 
                      className={`flex items-center justify-between text-white/80 py-2 px-3 rounded-lg hover:bg-white/10 transition-all duration-200 ${
                        item.highlight ? 'bg-yellow-500/10 text-yellow-300' : ''
                      }`}
                      style={{animationDelay: `${index * 0.1}s`}}
                    >
                      <span className="flex items-center gap-2">
                        {item.icon}
                        {item.label}
                      </span>
                      <span className="font-medium">{item.value} min</span>
                    </div>
                  ))}
                  
                  <hr className="border-white/20 my-4" />
                  
                  <div className="flex items-center justify-between text-white font-bold text-xl py-3 bg-white/10 rounded-lg px-4">
                    <span className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Arrival time
                    </span>
                    <span className="flex items-center gap-2">
                      {formatTime12Hour(results.classTime)}
                      {results.isNextDay && (
                        <span className="text-yellow-300 text-sm">(Tomorrow)</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Route Map - Shows after calculation */}
            {showRouteMap && (
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 transform hover:scale-[1.02] transition-all duration-300">
                <h3 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
                  <Map className="w-5 h-5" />
                  Your Route
                </h3>
                <div id="route-map-container" className="w-full h-64 rounded-lg overflow-hidden"></div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60">Distance</div>
                    <div className="text-white font-medium">{trafficData.route?.routes[0]?.sections[0]?.travelSummary?.length ? 
                      `${(trafficData.route.routes[0].sections[0].travelSummary.length / 1609.34).toFixed(1)} miles` : 
                      'N/A'
                    }</div>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <div className="text-white/60">Estimated Time</div>
                    <div className="text-white font-medium">{trafficData.totalTime} minutes</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map Modal */}
      {showMapModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="p-4 border-b border-white/20 flex items-center justify-between">
              <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                <Map className="w-5 h-5" />
                Select Location on Map
              </h3>
              <button
                onClick={() => setShowMapModal(false)}
                className="text-white/60 hover:text-white transition-colors duration-200"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4">
              <p className="text-white/70 text-sm mb-4">
                Click anywhere on the map to select your destination
              </p>
              <div id="map-container" className="w-full h-96 rounded-lg overflow-hidden"></div>
              
              {settings.destination && (
                <div className="mt-4 p-3 bg-white/10 rounded-lg">
                  <p className="text-white/70 text-sm">Selected address:</p>
                  <p className="text-white font-medium">{settings.destination}</p>
                </div>
              )}
              
              <div className="mt-4 flex gap-3 justify-end">
                <button
                  onClick={() => setShowMapModal(false)}
                  className="px-6 py-2 text-white/70 hover:text-white transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowMapModal(false);
                  }}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all duration-200"
                  disabled={!settings.destination}
                >
                  Confirm Location
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MorningCalculator;