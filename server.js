import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import https from "https";
import http from "http";

// Helper: follows redirects automatically
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpGet(res.headers.location).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error("Invalid JSON response")); }
      });
    }).on("error", reject);
  });
}

function codeToDesc(code) {
  if (code === 0)  return "☀️  Clear sky";
  if (code <= 2)   return "🌤️  Partly cloudy";
  if (code === 3)  return "☁️  Overcast";
  if (code <= 49)  return "🌫️  Foggy";
  if (code <= 57)  return "🌦️  Drizzle";
  if (code <= 67)  return "🌧️  Rain";
  if (code <= 77)  return "❄️  Snow";
  if (code <= 82)  return "🌦️  Rain showers";
  if (code <= 86)  return "🌨️  Snow showers";
  if (code >= 95)  return "⛈️  Thunderstorm";
  return "🌡️  Unknown";
}

// Create the MCP Server
const server = new McpServer({ name: "weather-mcp", version: "1.0.0" });

// ─────────────────────────────────────────────
// TOOL 1: get_weather
// ─────────────────────────────────────────────
server.tool(
  "get_weather",
  "Get current weather and 3-day forecast for any city. Free, no API key needed.",
  {
    city: z.string().describe("City name, e.g. Algiers, Paris, London"),
    units: z.enum(["metric", "imperial"]).default("metric").describe("metric=°C, imperial=°F"),
  },
  async ({ city, units }) => {
    try {
      const geoData = await httpGet(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
      );
      if (!geoData.results || geoData.results.length === 0) {
        return { content: [{ type: "text", text: `❌ City "${city}" not found.` }] };
      }
      const { name, country, latitude, longitude } = geoData.results[0];
      const tempUnit = units === "imperial" ? "fahrenheit" : "celsius";
      const windUnit = units === "imperial" ? "mph" : "kmh";
      const w = await httpGet(
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature` +
        `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum` +
        `&temperature_unit=${tempUnit}&wind_speed_unit=${windUnit}` +
        `&forecast_days=4&timezone=auto`
      );
      const deg = units === "imperial" ? "°F" : "°C";
      const spd = units === "imperial" ? "mph" : "km/h";
      let result = `🌍 Weather for ${name}, ${country}\n`;
      result += `${"─".repeat(35)}\n`;
      result += `🌤️  Now:        ${codeToDesc(w.current.weather_code)}\n`;
      result += `🌡️  Temp:       ${w.current.temperature_2m}${deg} (feels like ${w.current.apparent_temperature}${deg})\n`;
      result += `💧 Humidity:   ${w.current.relative_humidity_2m}%\n`;
      result += `💨 Wind:       ${w.current.wind_speed_10m} ${spd}\n\n`;
      result += `📅 3-Day Forecast:\n`;
      for (let i = 1; i <= 3; i++) {
        const date = new Date(w.daily.time[i]).toLocaleDateString("en-US", {
          weekday: "long", month: "short", day: "numeric",
        });
        const rain = w.daily.precipitation_sum[i];
        result += `  ${date}\n    ${codeToDesc(w.daily.weather_code[i])}\n`;
        result += `    Min: ${w.daily.temperature_2m_min[i]}${deg}  Max: ${w.daily.temperature_2m_max[i]}${deg}`;
        result += rain > 0 ? `  🌧️ Rain: ${rain}mm\n` : `\n`;
      }
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
    }
  }
);

// ─────────────────────────────────────────────
// TOOL 2: convert_currency
// Uses ExchangeRate-API (free, no key, works globally)
// ─────────────────────────────────────────────
server.tool(
  "convert_currency",
  "Convert an amount from one currency to another using live exchange rates. Free, no API key needed.",
  {
    from: z.string().describe("Source currency code, e.g. USD, EUR, DZD, GBP"),
    to: z.string().describe("Target currency code, e.g. EUR, DZD, MAD, JPY"),
    amount: z.number().describe("Amount to convert, e.g. 100"),
  },
  async ({ from, to, amount }) => {
    try {
      const fromUpper = from.toUpperCase();
      const toUpper = to.toUpperCase();

      // ExchangeRate-API: free, no key, works globally
      const data = await httpGet(
        `https://open.er-api.com/v6/latest/${fromUpper}`
      );

      if (data.result === "error") {
        return { content: [{ type: "text", text: `❌ Error: ${data["error-type"]}` }] };
      }

      const rate = data.rates[toUpper];
      if (rate === undefined) {
        return { content: [{ type: "text", text: `❌ Currency "${toUpper}" not found. Use codes like USD, EUR, DZD, GBP, JPY, MAD...` }] };
      }

      const converted = (rate * amount).toFixed(2);
      const updated = new Date(data.time_last_update_utc).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });

      let result = `💱 Currency Conversion\n`;
      result += `${"─".repeat(35)}\n`;
      result += `💰 Amount:     ${amount} ${fromUpper}\n`;
      result += `💵 Converted:  ${converted} ${toUpper}\n`;
      result += `📈 Rate:       1 ${fromUpper} = ${rate.toFixed(4)} ${toUpper}\n`;
      result += `📅 Updated:    ${updated}\n`;

      return { content: [{ type: "text", text: result }] };

    } catch (err) {
      return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("✅ Weather + Currency MCP server running...");
