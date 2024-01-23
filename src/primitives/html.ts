export const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JetPath API Preview</title>
    <style>
      body {
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f4f4f4;
        color: #333;
      }

      header {
        background-color: #007bff; 
        text-align: center;
        color: #fff;
        font-size: 24px;
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 1rem;
      }

      .request-container {
        margin: 20px;
        padding: 20px;
        border: 1px solid #ccc;
        border-radius: 5px;
        background-color: #fff;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        transition: transform 0.3s ease-in-out;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .request {
        margin-bottom: 10px;
      }

      .headers,
      .payload {
        margin-left: 20px;
      }

      .payload {
        white-space: pre-wrap;
      }

      .test-button {
        background-color: #007bff;
        color: #fff;
        border: none;
        padding: 10px 18px;
        border-radius: 5px;
        cursor: pointer;
        transition: background-color 0.3s ease-in-out;
      }

      .test-button:hover {
        background-color: #0056b3;
      }

      .response-container {
        border: 1px solid #ccc;
        border-radius: 5px;
        background-color: #fff;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        display: none;
        margin: 20px;
        padding: 20px;
      }
      textarea {
        margin-top: 0.4rem;
        min-width: 60vw;
        min-height: 10rem;
        padding: 1rem;
        border: 3px solid #007bff;
        border-radius: 20px;
        outline: none;
      }
      textarea#keys {
        margin-top: 0.4rem;
        min-width: 30vw;
        min-height: 5rem;
        padding: 0.6rem;
        border: 2px solid #007bff;
        border-radius: 10px;
        outline: none;
      }
      textarea:focus {
        border: 3px solid #007bff5e;
      }
    </style>
  </head>
  <body>
    <header><img src="https://raw.githubusercontent.com/Uiedbook/JetPath/main/icon-transparent.webp" alt="JetPath" style="width: 7rem;" > <h1>JetPath API Preview</h1></header>
    <div class="request-container">
      <h4>headers:</h4>
      <textarea id="keys">
 {
   "Authetication": "Bearer ****"
     
 }</textarea
      >
    </div>
    <h3 class="request-container">Requests</h>
    <script>
      function parseApiDocumentation(apiDocumentation) {
        const requests = (apiDocumentation
          .split("###")
          .map((request) => request.trim())).filter((a)=>a !== "");

        return requests.map(parseRequest);
      }

      function parseRequest(requestString) {
        const lines = requestString.split("\\n").map((line) => line.trim());

        // Parse HTTP request line
        const requestLine = lines[0].split(" ");
        const method = requestLine[0];
        const url = requestLine[1];
        const httpVersion = requestLine[2];

        // Parse headers
        const headers = {};
        for (let i = 1; i < lines.length; i++) {
          if (lines[i] === "") break; // Headers end when a blank line is encountered
          const [key, value] = lines[i].split(":").map((part) => part.trim());
          headers[key.toLowerCase()] = value;
        }

        // Parse payload if it exists
        const payloadIndex = lines.indexOf("") + 1;
        const payload =
          payloadIndex !== 0 ? lines.slice(payloadIndex).join("\\n") : null;

        return {
          method,
          url,
          httpVersion,
          headers,
          payload,
        };
      }
      // Example API documentation
      const apiDocumentation = '{JETPATH}';

      // Parse API documentation
      const parsedApi = parseApiDocumentation(apiDocumentation);

      // Display API documentation in UI and add testing functionality
      parsedApi.forEach((request) => {
        const requestContainer = document.createElement("div");
        requestContainer.classList.add("request-container");

        const requestInfo = document.createElement("div");
        requestInfo.classList.add("request");
        const urlInput = document.createElement("input");
        urlInput.type = "text";
        urlInput.value = request.url;
        requestInfo.appendChild(document.createTextNode(request.method + " "));
        requestInfo.appendChild(urlInput);
        requestInfo.appendChild(
          document.createTextNode(" " + request.httpVersion)
        );
        requestContainer.appendChild(requestInfo);

        const headersContainer = document.createElement("div");
        headersContainer.classList.add("headers");
        headersContainer.innerHTML = "<strong>Headers:</strong>";
        for (const [key, value] of Object.entries(request.headers)) {
          const headerInput = document.createElement("input");
          headerInput.type = "text";
          headerInput.value = key+": "+value;
          headersContainer.appendChild(document.createElement("br"));
          headersContainer.appendChild(headerInput);
        }
        requestContainer.appendChild(headersContainer);

        if (request.payload) {
          const payloadContainer = document.createElement("div");
          payloadContainer.classList.add("payload");
          payloadContainer.innerHTML = "<strong>Payload:</strong><br>";
          const payloadTextarea = document.createElement("textarea");
          payloadTextarea.value = request.payload;
          payloadContainer.appendChild(payloadTextarea);
          requestContainer.appendChild(payloadContainer);
        }

        const testButton = document.createElement("button");
        testButton.classList.add("test-button");
        testButton.textContent = "Test API";
        testButton.addEventListener("click", async () => {
          const updatedRequest = {
            method: requestInfo.firstChild.textContent.trim(),
            url: urlInput.value.trim(),
            httpVersion: requestInfo.lastChild.textContent.trim(),
            headers: {},
            payload: "",
          };

          headersContainer.querySelectorAll("input").forEach((headerInput) => {
            const [key, value] = headerInput.value
              .split(":")
              .map((part) => part.trim());
            if (key) {
              updatedRequest.headers[key] = value || "";
            }
          });

          if (request.payload) {
            updatedRequest.payload = request.payload.trim();
          }
const keys = document.getElementById("keys");
let keysHeaders={}
try {
  console.log(keys.value);
  keysHeaders = JSON.parse(keys.value);
} catch (error) {
  alert(error);
}
          const response = await testApi(
            updatedRequest.method,
            updatedRequest.url,
            Object.assign(updatedRequest.headers, keysHeaders),
            updatedRequest.payload || undefined
          ); 
          showApiResponse(response);
        });
        requestContainer.appendChild(testButton);

        const responseContainer = document.createElement("div");
        responseContainer.classList.add("response-container");
        document.body.appendChild(requestContainer);
        document.body.appendChild(responseContainer);

        function showApiResponse(response) {
          responseContainer.innerHTML = "<strong>API Response:</strong><br>";
          responseContainer.innerHTML += "<pre>"+JSON.stringify(
            response,
            null,
            2
          )+"</pre>";
          responseContainer.scrollIntoView({
            behavior: "smooth",
            block: "end",
          });
          responseContainer.style.display = "block";
        }
      });

      async function testApi(method, url, headers, payload) {
        try {
          const response = await fetch(url, {
            method,
            headers,
            body: payload,
          });

          const responseBody = await response.text();
          return {
            status: response.status,
            headers: response.headers,
            body: responseBody,
          };
        } catch (error) {
          return { error: error.message };
        }
      }
    </script>
  </body>
</html>`;
