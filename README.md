# 🌤️ MCP Toolkit Server

A **Model Context Protocol (MCP)** server that gives AI the superpower to fetch real-time weather for any city in the world, using the [Open-Meteo API](https://open-meteo.com/), which is 100% free with no API key needed.

---

## 📖 What is MCP?

**MCP (Model Context Protocol)** is an open standard created by Anthropic that allows AI models to connect to tools and data from the outside world, instead of only replying from what they were trained on.

Without MCP, an AI can only answer based on its training data. With MCP, you give it real superpowers:

| Without MCP | With MCP |
|-------------|----------|
| Static knowledge | Live data from APIs |
| No file access | Can read and write files |
| No system interaction | Can run shell commands |
| Frozen in time | Real-time information |

### How it works

```
You ask AI: "What's the weather in Algiers?"
         ↓
AI sees it has a tool called get_weather
         ↓
AI calls: get_weather({ city: "Algiers" })
         ↓
MCP server fetches the Open-Meteo API
         ↓
Returns real weather data as text
         ↓
AI reads it and answers you naturally
```

The MCP server is a Node.js process. The AI client launches it automatically and communicates through **stdin/stdout using JSON-RPC**. The AI never touches the API directly, it just calls your tool and reads the result.

---

## 🛠️ This Project — Two Tools

### Tool 1: `get_weather`

| Property | Value |
|----------|-------|
| **Name** | `get_weather` |
| **Description** | Get current weather and 3-day forecast for any city |
| **API** | [Open-Meteo](https://open-meteo.com/) + Geocoding API |
| **API Key** | ❌ Not required |

The tool makes two API calls under the hood:

**Step 1 — Convert city name to coordinates:**
```
GET https://geocoding-api.open-meteo.com/v1/search?name=Algiers
→ Returns: { latitude: 36.73, longitude: 3.08, country: "Algeria" }
```

**Step 2 — Fetch weather using coordinates:**
```
GET https://api.open-meteo.com/v1/forecast?latitude=36.73&longitude=3.08
       &current=temperature_2m,humidity,wind_speed,weather_code
       &daily=temperature_2m_max,temperature_2m_min,precipitation_sum
→ Returns: live weather + 3-day forecast
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `city` | string | ✅ Yes | Any city — `Algiers`, `Paris`, `Tokyo`... |
| `units` | enum | ❌ No | `metric` for °C (default) or `imperial` for °F |

---

### Tool 2: `convert_currency`

| Property | Value |
|----------|-------|
| **Name** | `convert_currency` |
| **Description** | Convert an amount from one currency to another using live exchange rates |
| **API** | [ExchangeRate-API](https://open.er-api.com/) |
| **API Key** | ❌ Not required |

**How the API call works:**
```
GET https://open.er-api.com/v6/latest/USD
→ Returns: { rates: { DZD: 133.15, EUR: 0.91, GBP: 0.78, JPY: 160.35, ... } }
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from` | string | ✅ Yes | Source currency code — `USD`, `EUR`, `GBP`, `DZD`... |
| `to` | string | ✅ Yes | Target currency code — `DZD`, `JPY`, `MAD`, `USD`... |
| `amount` | number | ✅ Yes | Amount to convert — `100`, `500`, `1000`... |

---

## 📁 Project Structure

```
weather-mcp/
├── server.js       ← The MCP server defines both tools
├── test.js         ← Local test script runs without any AI
├── package.json    ← Project dependencies
├── README.md       ← This file
└── screenshots/    ← Proof it works
```

---

## 🚀 How to Run Everything

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher, check with `node -v`

### Step 1 : Install dependencies

Open a terminal inside the `weather-mcp` folder:

```bash
npm install
```

### Step 2 : Test directly in the terminal

```bash
node test.js
```

This runs all tools and prints real results, no AI needed.

---

## ✅ Results : Everything Works!

### Weather tests

**Algiers, Algeria:**

![Terminal test : Algiers](screenshots/test-algiers.png)

**Paris, France:**

![Terminal test : Paris](screenshots/test-paris.png)

**New York, USA (imperial):**

![Terminal test : New York](screenshots/test-newyork.png)

---

### Currency converter tests

**100 USD → DZD:**

![Currency test : USD to DZD](screenshots/currency-usd-dzd.png)

**50 EUR → USD:**

![Currency test : EUR to USD](screenshots/currency-eur-usd.png)

**200 GBP → JPY:**

![Currency test : GBP to JPY](screenshots/currency-gbp-jpy.png)

---

### MCP Inspector : Both tools visible

After connecting to the Inspector, both tools appear in the Tools list:

![MCP Inspector : two tools listed](screenshots/inspector-two-tools.png)

**Testing `convert_currency` in the Inspector (500 USD → JPY):**

![MCP Inspector : currency form](screenshots/inspector-currency-form.png)

**Result:**

![MCP Inspector : currency result](screenshots/inspector-currency-result.png)

---

## 🧪 Testing with MCP Inspector

MCP Inspector is an official Anthropic tool that lets you test your MCP server in a browser UI — no AI subscription needed.

```bash
npx -y @modelcontextprotocol/inspector node server.js
```

Open `http://localhost:5173` → click **Connect** → click **Tools** → pick a tool → fill in the fields → click **Run Tool**.

---

## 🤖 Connect to an AI (Optional)

### Claude Desktop (requires Claude Pro)

Find the config file:
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "weather-currency": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\Users\\YOUR_USERNAME\\Desktop\\weather-mcp\\server.js"]
    }
  }
}
```

Save → fully quit Claude Desktop → reopen → look for the 🔧 icon.

## ➕ How to Add a New Superpower

Adding a new tool takes 3 steps. Here's an example — a **country info** tool:

### Step 1 : Add the tool in `server.js`

After the last `server.tool(...)` block, add:

```javascript
server.tool(
  "get_country_info",
  "Get general information about any country: capital, population, languages, region.",
  {
    country: z.string().describe("Country name, e.g. Algeria, France, Japan"),
  },
  async ({ country }) => {
    try {
      const data = await httpGet(
        `https://restcountries.com/v3.1/name/${encodeURIComponent(country)}?fullText=true`
      );
      const c = data[0];
      const languages = Object.values(c.languages || {}).join(", ");
      const currencies = Object.values(c.currencies || {}).map(x => x.name).join(", ");

      let result = `🌍 ${c.name.common} (${c.name.official})\n`;
      result += `${"─".repeat(35)}\n`;
      result += `🏛️  Capital:     ${c.capital?.[0] || "N/A"}\n`;
      result += `🌎 Region:      ${c.region} — ${c.subregion}\n`;
      result += `👥 Population:  ${c.population.toLocaleString()}\n`;
      result += `🗣️  Languages:   ${languages}\n`;
      result += `💰 Currency:    ${currencies}\n`;
      result += `🗺️  Area:        ${c.area.toLocaleString()} km²\n`;

      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      return { content: [{ type: "text", text: `❌ Country "${country}" not found.` }] };
    }
  }
);
```

### Step 2 : Test it

```bash
node test.js
```

### Step 3 : Restart the Inspector or Claude Desktop

The new tool appears automatically — no rebuild needed.

---

### More superpower ideas

| Superpower | Free API | Example prompt |
|------------|----------|----------------|
| 🌍 Country info | [restcountries.com](https://restcountries.com/) | "Tell me about Algeria" |
| 😂 Random joke | [v2.jokeapi.dev](https://v2.jokeapi.dev/) | "Tell me a programming joke" |
| 📰 Latest news | [newsapi.org](https://newsapi.org/) | "What's in the news today?" |
| 🎬 Movie info | [omdbapi.com](https://www.omdbapi.com/) | "Tell me about Interstellar" |
| 🗺️ IP location | [ip-api.com](https://ip-api.com/) | "Where is IP 8.8.8.8?" |
| 📈 Stock price | [Yahoo Finance](https://finance.yahoo.com/) | "What's Apple's stock price?" |

Every new tool follows the same pattern: **define → test → done**.

---

## 📚 Resources

- [MCP Official Docs](https://modelcontextprotocol.io)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Open-Meteo API Docs](https://open-meteo.com/en/docs)
- [ExchangeRate-API Docs](https://www.exchangerate-api.com/docs/free)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [Ollama](https://ollama.com)

---


