import React, { useState, useEffect } from 'react';
import { Clock, MapPin, Cloud, User, Bell, Sun, Moon, CloudRain, Search, Map, Navigation } from 'lucide-react';

// Add before your component
interface AddressSuggestion {
  title: string;
  position?: {
    lat: number;
    lng: number;
  };
  address?: {
    label: string;
  };
}

const MorningCalculator = () => {
  const [settings, setSettings] = useState({
    classTime: '08:00',
    destination: '',
    destinationCoords: null,
    normalCommute: 25,
    getReadyTime: 30,
    personType: 'normal',
    bufferTime: 10
  });

  const [results, setResults] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showMapMode, setShowMapMode] = useState(false);

  // API Configuration
  const apiKeys = {
    weather: 'c5b866ecee2d1647c5472b0322d6c08c',
    hereAppId: 'CGdQabamBZVD4GhTYIjm',
    hereApiKey: 'ub9mmoHcVMzP2Edf0-1xp617AhdLt0dNpARLxSKuOTg'
  };

  // State for real-time data
  const [weatherData, setWeatherData] = useState({
    condition: 'sunny',
    temp: 75,
    precipitation: 0,
    description: 'Clear skies'
  });

  const [wakeUpWeatherData, setWakeUpWeatherData] = useState({
    condition: 'sunny',
    temp: 72,
    precipitation: 0,
    description: 'Clear morning'
  });

  const [trafficData, setTrafficData] = useState({
    delay: 8,
    condition: 'moderate'
  });

  const [isLoading, setIsLoading] = useState(false);
  const [animationClass, setAnimationClass] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const personTypes = {
    'heavy-sleeper': { snoozes: 3, extraBuffer: 15, label: 'Heavy Sleeper' },
    'normal': { snoozes: 1, extraBuffer: 5, label: 'Normal Sleeper' },
    'light-sleeper': { snoozes: 0, extraBuffer: 0, label: 'Light Sleeper' },
    'always-late': { snoozes: 2, extraBuffer: 20, label: 'Always Late' }
  };

  // Address autocomplete
  const searchAddresses = async (query) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      return;
    }

    try {
      const response = await fetch(
        `https://autocomplete.search.hereapi.com/v1/autocomplete?q=${encodeURIComponent(query)}&limit=5&apikey=${apiKeys.hereApiKey}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setAddressSuggestions(data.items || []);
      }
    } catch (error) {
      console.error('Address search error:', error);
    }
  };

  const handleAddressChange = (value) => {
    setSettings({...settings, destination: value});
    setShowSuggestions(true);
    
    // Debounce address search
    const timeoutId = setTimeout(() => {
      searchAddresses(value);
    }, 300);

    return () => clearTimeout(timeoutId);
  };

  const selectAddress = (item) => {
    setSettings({
      ...settings, 
      destination: item.title,
      destinationCoords: item.position
    });
    setShowSuggestions(false);
    setAddressSuggestions([]);
  };

  // Fetch weather for wake-up time
  const fetchWakeUpWeatherData = async (wakeUpTime) => {
    try {
      const position = await new Promise((resolve, reject) => {
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
      
      if (wakeUpDate <= now) {
        wakeUpDate.setDate(wakeUpDate.getDate() + 1);
      }
      
      const hoursUntilWakeUp = Math.ceil((wakeUpDate - now) / (1000 * 60 * 60));
      
      // Use forecast API for future weather
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${latitude}&lon=${longitude}&appid=${apiKeys.weather}&units=imperial&cnt=${Math.min(hoursUntilWakeUp, 40)}`
      );
      
      if (!response.ok) throw new Error('Weather forecast API failed');
      
      const data = await response.json();
      
      // Find the forecast closest to wake-up time
      const targetTime = wakeUpDate.getTime();
      const closestForecast = data.list.reduce((closest, forecast) => {
        const forecastTime = forecast.dt * 1000;
        const closestTime = closest.dt * 1000;
        
        return Math.abs(forecastTime - targetTime) < Math.abs(closestTime - targetTime) 
          ? forecast : closest;
      });
      
      return {
        condition: closestForecast.weather[0].main.toLowerCase(),
        temp: Math.round(closestForecast.main.temp),
        precipitation: closestForecast.rain ? (closestForecast.rain['3h'] || 0) : 
                      (closestForecast.snow ? (closestForecast.snow['3h'] || 0) : 0),
        description: closestForecast.weather[0].description
      };
    } catch (error) {
      console.error('Wake-up weather API error:', error);
      return wakeUpWeatherData;
    }
  };

  const fetchCurrentWeatherData = async () => {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          enableHighAccuracy: true
        });
      });
      
      const { latitude, longitude } = position.coords;
      
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKeys.weather}&units=imperial`
      );
      
      if (!response.ok) throw new Error('Weather API failed');
      
      const data = await response.json();
      
      return {
        condition: data.weather[0].main.toLowerCase(),
        temp: Math.round(data.main.temp),
        precipitation: data.rain ? (data.rain['1h'] || 0) : (data.snow ? (data.snow['1h'] || 0) : 0),
        description: data.weather[0].description
      };
    } catch (error) {
      console.error('Weather API error:', error);
      return weatherData;
    }
  };

  const fetchTrafficData = async () => {
    if (!settings.destination.trim()) {
      return { ...trafficData, error: 'No destination set' };
    }
    
    try {
      const position = await new Promise((resolve, reject) => {
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
      
      setSettings(prev => ({ ...prev, normalCommute: baseTimeMinutes }));
      
      return {
        delay: trafficDelay,
        condition: trafficDelay > 10 ? 'heavy' : trafficDelay > 5 ? 'moderate' : 'light',
        totalTime: travelTimeMinutes,
        baseTime: baseTimeMinutes,
        route: route
      };
      
    } catch (error) {
      console.error('Traffic API error:', error);
      return { ...trafficData, error: error.message };
    }
  };

  const calculateWakeUpTime = async () => {
    setIsLoading(true);
    setAnimationClass('animate-pulse');
    
    // Fetch real-time data
    const currentWeather = await fetchCurrentWeatherData();
    const currentTraffic = await fetchTrafficData();
    
    setWeatherData(currentWeather);
    setTrafficData(currentTraffic);
    
    const classTimeMinutes = timeToMinutes(settings.classTime);
    const commuteWithTraffic = settings.normalCommute + currentTraffic.delay;
    const weatherDelay = currentWeather.precipitation > 0 ? 5 : 0;
    const personTypeData = personTypes[settings.personType];
    
    const totalPreparationTime = 
      settings.getReadyTime + 
      commuteWithTraffic + 
      weatherDelay + 
      settings.bufferTime + 
      personTypeData.extraBuffer;

    const wakeUpTimeMinutes = classTimeMinutes - totalPreparationTime;
    const snoozeTime = personTypeData.snoozes * 9;
    const actualWakeUpTime = wakeUpTimeMinutes - snoozeTime;

    const wakeUpTimeString = minutesToTime(actualWakeUpTime);
    
    // Fetch weather for wake-up time
    const wakeUpWeather = await fetchWakeUpWeatherData(wakeUpTimeString);
    setWakeUpWeatherData(wakeUpWeather);

    const breakdown = {
      classTime: settings.classTime,
      wakeUpTime: wakeUpTimeString,
      firstAlarmTime: minutesToTime(wakeUpTimeMinutes),
      snoozes: personTypeData.snoozes,
      breakdown: {
        getReady: settings.getReadyTime,
        commute: settings.normalCommute,
        trafficDelay: currentTraffic.delay,
        weatherDelay,
        buffer: settings.bufferTime,
        personalBuffer: personTypeData.extraBuffer,
        snoozeTime
      }
    };

    setResults(breakdown);
    setIsLoading(false);
    setAnimationClass('animate-bounce');
    
    setTimeout(() => setAnimationClass(''), 1000);
  };

  const timeToMinutes = (timeStr) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const minutesToTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const getWeatherIcon = (condition) => {
    switch(condition) {
      case 'sunny':
      case 'clear': return <Sun className="w-6 h-6 text-yellow-400" />;
      case 'rain':
      case 'drizzle': return <CloudRain className="w-6 h-6 text-blue-400" />;
      case 'clouds':
      case 'cloudy': return <Cloud className="w-6 h-6 text-gray-300" />;
      default: return <Cloud className="w-6 h-6 text-gray-300" />;
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 p-4 transition-all duration-500">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8 animate-fade-in">
          <h1 className="text-3xl font-bold text-white mb-2">Morning Calculator</h1>
          <p className="text-white/80">Never oversleep again</p>
          <div className="text-white/90 mt-4 text-lg font-mono">
            {currentTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>

        {/* Current vs Wake-up Weather Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Current Weather */}
          <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-4 border border-white/20 transform hover:scale-105 transition-all duration-300">
            <div className="text-center">
              <div className="text-white/80 text-sm mb-2">Now</div>
              {getWeatherIcon(weatherData.condition)}
              <div className="text-white font-medium text-lg">{weatherData.temp}°F</div>
              <div className="text-white/70 text-xs capitalize">{weatherData.description}</div>
            </div>
          </div>

          {/* Wake-up Weather */}
          <div className="bg-white/30 backdrop-blur-lg rounded-2xl p-4 border border-white/30 transform hover:scale-105 transition-all duration-300">
            <div className="text-center">
              <div className="text-white/80 text-sm mb-2">Wake-up</div>
              {getWeatherIcon(wakeUpWeatherData.condition)}
              <div className="text-white font-medium text-lg">{wakeUpWeatherData.temp}°F</div>
              <div className="text-white/70 text-xs capitalize">{wakeUpWeatherData.description}</div>
            </div>
          </div>
        </div>

        {/* Traffic Info */}
        <div className="bg-white/20 backdrop-blur-lg rounded-2xl p-4 mb-6 border border-white/20 transform hover:scale-105 transition-all duration-300">
          <div className={`flex items-center justify-center space-x-2 ${getTrafficColor()}`}>
            <Navigation className="w-5 h-5" />
            <div className="text-center">
              <div className="font-medium">+{trafficData.delay}min traffic</div>
              {trafficData.totalTime && (
                <div className="text-xs opacity-80">{trafficData.totalTime}min total</div>
              )}
            </div>
          </div>
          {trafficData.error && (
            <div className="text-red-200 text-sm mt-2 text-center">
              ⚠️ {trafficData.error}
            </div>
          )}
        </div>

        {/* Settings Card */}
        <div className={`bg-white/20 backdrop-blur-lg rounded-3xl p-6 mb-6 border border-white/20 transform transition-all duration-500 ${animationClass}`}>
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
            <User className="w-5 h-5 mr-2" />
            Your Settings
          </h2>
          
          <div className="space-y-4">
            <div className="transform hover:scale-105 transition-all duration-200">
              <label className="block text-white/80 text-sm mb-2">Arrival Time</label>
              <input
                type="time"
                value={settings.classTime}
                onChange={(e) => setSettings({...settings, classTime: e.target.value})}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:bg-white/20 focus:border-white/40 transition-all duration-200"
              />
            </div>

            <div className="relative transform hover:scale-105 transition-all duration-200">
              <label className="block text-white/80 text-sm mb-2">Destination</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Enter your destination address..."
                  value={settings.destination}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/60 focus:bg-white/20 focus:border-white/40 transition-all duration-200"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex space-x-2">
                  <Search className="w-4 h-4 text-white/60" />
                  <button
                    onClick={() => setShowMapMode(!showMapMode)}
                    className="text-white/60 hover:text-white transition-colors duration-200"
                  >
                    <Map className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {/* Address Suggestions Dropdown */}
              {showSuggestions && addressSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl max-h-48 overflow-y-auto">
                  {addressSuggestions.map((item, index) => (
                    <button
                      key={index}
                      onClick={() => selectAddress(item)}
                      className="w-full text-left px-4 py-3 text-white hover:bg-white/20 transition-all duration-200 first:rounded-t-xl last:rounded-b-xl"
                    >
                      <div className="font-medium">{item.title}</div>
                      {item.address && (
                        <div className="text-white/60 text-sm">{item.address.label}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              <div className="text-white/60 text-xs mt-1">
                📍 We'll use your current location as the starting point
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="transform hover:scale-105 transition-all duration-200">
                <label className="block text-white/80 text-sm mb-2">Commute (min)</label>
                <input
                  type="number"
                  value={settings.normalCommute}
                  onChange={(e) => setSettings({...settings, normalCommute: parseInt(e.target.value)})}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:bg-white/20 focus:border-white/40 transition-all duration-200"
                />
              </div>

              <div className="transform hover:scale-105 transition-all duration-200">
                <label className="block text-white/80 text-sm mb-2">Get Ready (min)</label>
                <input
                  type="number"
                  value={settings.getReadyTime}
                  onChange={(e) => setSettings({...settings, getReadyTime: parseInt(e.target.value)})}
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:bg-white/20 focus:border-white/40 transition-all duration-200"
                />
              </div>
            </div>

            <div className="transform hover:scale-105 transition-all duration-200">
              <label className="block text-white/80 text-sm mb-2">Person Type</label>
              <select
                value={settings.personType}
                onChange={(e) => setSettings({...settings, personType: e.target.value})}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:bg-white/20 focus:border-white/40 transition-all duration-200"
              >
                {Object.entries(personTypes).map(([key, type]) => (
                  <option key={key} value={key} className="bg-gray-800">
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="transform hover:scale-105 transition-all duration-200">
              <label className="block text-white/80 text-sm mb-2">Buffer Time (min)</label>
              <input
                type="number"
                value={settings.bufferTime}
                onChange={(e) => setSettings({...settings, bufferTime: parseInt(e.target.value)})}
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/60 focus:bg-white/20 focus:border-white/40 transition-all duration-200"
              />
            </div>
          </div>

          <button
            onClick={calculateWakeUpTime}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 rounded-xl py-4 mt-6 text-white font-semibold transition-all duration-300 flex items-center justify-center space-x-2 transform hover:scale-105 disabled:scale-100 shadow-lg hover:shadow-xl"
          >
            <Bell className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Calculating...' : 'Calculate My Wake Up Time'}</span>
          </button>
        </div>

        {/* Results Card */}
        {results && (
          <div className="bg-white/20 backdrop-blur-lg rounded-3xl p-6 border border-white/20 animate-fade-in transform hover:scale-105 transition-all duration-500">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Your Perfect Schedule
            </h2>
            
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-green-400/20 to-blue-500/20 rounded-2xl p-6 border border-white/30">
                <div className="text-center">
                  <div className="text-4xl font-bold text-white mb-2 animate-pulse">{results.wakeUpTime}</div>
                  <div className="text-white/80 text-lg">Wake Up Time</div>
                  {results.snoozes > 0 && (
                    <div className="text-sm text-white/60 mt-2">
                      First alarm: {results.firstAlarmTime} ({results.snoozes} snoozes included)
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {[
                  ['Getting ready', results.breakdown.getReady],
                  ['Normal commute', results.breakdown.commute],
                  ['Traffic delay', `+${results.breakdown.trafficDelay}`],
                  ...(results.breakdown.weatherDelay > 0 ? [['Weather delay', `+${results.breakdown.weatherDelay}`]] : []),
                  ['Buffer time', results.breakdown.buffer],
                  ['Personal buffer', results.breakdown.personalBuffer],
                  ...(results.breakdown.snoozeTime > 0 ? [['Snooze time', results.breakdown.snoozeTime]] : [])
                ].map(([label, value], index) => (
                  <div key={label} className="flex justify-between text-white/80 text-sm py-1 hover:bg-white/10 rounded-lg px-2 transition-all duration-200" style={{animationDelay: `${index * 0.1}s`}}>
                    <span>{label}</span>
                    <span>{value} min</span>
                  </div>
                ))}
                <hr className="border-white/20 my-3" />
                <div className="flex justify-between text-white font-medium text-lg py-2 bg-white/10 rounded-lg px-2">
                  <span>Arrival time</span>
                  <span>{results.classTime}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MorningCalculator;