const MAX_HISTORY_ITEMS = 10;
let requestHistory = JSON.parse(localStorage.getItem("jetpathApiHistory")!) ||
  [];
const apiDocumentationRawTemplate = `{ JETPATH }`;
const apiGlobalHeadersRaw = `{ JETPATHGH }`;
const currentYear = new Date().getFullYear();
if (document.querySelector("footer small")) {
  document.querySelector("footer small")!.textContent = document.querySelector(
    "footer small",
  )!.textContent!.replace("{CURRENT_YEAR}", String(currentYear));
}

const environments = typeof `{ JETENVIRONMENTS }` === "object"
  ? `{ JETENVIRONMENTS }` as any
  : {
    "Default (Current Host)": typeof window !== "undefined"
      ? window.location.origin
      : "",
  };
let currentBaseUrl = environments["Default (Current Host)"]!;

// --- UTILITY FUNCTIONS ---
function Rhoda(l: any[]) {
  const fg = new DocumentFragment();
  for (let ch of l) {
    if (Array.isArray(ch)) fg.appendChild(Rhoda(ch));
    else {
      if (typeof ch === "function") {
        ch = ch();
        if (typeof ch === "function") ch = ch();
      }
      if (ch instanceof HTMLElement || ch instanceof DocumentFragment) {
        fg.appendChild(ch);
        continue;
      }
      if (typeof ch === "string") fg.appendChild(document.createTextNode(ch));
    }
  }
  return fg;
}
const makeElement = (element: any, ElementChildrenAndPropertyList: any[]) => {
  const props = {};
  let text: string | undefined = undefined;
  if (ElementChildrenAndPropertyList.length !== 0) {
    for (let i = 0; i < ElementChildrenAndPropertyList.length; i++) {
      let ch = ElementChildrenAndPropertyList[i];
      if (typeof ch === "function") {
        ch = ch();
      }
      if (ch instanceof HTMLElement || ch instanceof DocumentFragment) {
        element.appendChild(ch);
        continue;
      }
      if (Array.isArray(ch)) {
        element.appendChild(Rhoda(ch));
        continue;
      }
      if (typeof ch === "string") {
        text = ch;
        continue;
      }
      if (typeof ch === "object" && ch !== null) {
        Object.assign(props, ch);
        continue;
      }
    }
  } else return element;
  if (typeof props === "object" && element) {
    for (const [prop, value] of Object.entries(props)) {
      if (prop === "style" && typeof value === "object") {
        Object.assign(element.style, value);
        continue;
      }
      if (prop.startsWith("on") && typeof value === "function") {
        element.addEventListener(prop.substring(2).toLowerCase(), value);
        continue;
      }
      if (prop.includes("data-") || prop.includes("aria-")) {
        element.setAttribute(prop, value);
        continue;
      }
      element[prop] = value;
    }
  }
  if (text !== undefined) element.appendChild(document.createTextNode(text));
  return element;
};
const cra = (tag: string) => (...Children_and_Properties: any[]) =>
  makeElement(document.createElement(tag), Children_and_Properties);
function $if(condition: any, ...elements: any[]) {
  if (condition) return Rhoda(elements.flat());
  return document.createDocumentFragment();
}
const button = cra("button");
const div = cra("div");
const h2 = cra("h2");
const h3 = cra("h3");
const h4 = cra("h4");
const h5 = cra("h5");
const input = cra("input");
const span = cra("span");
const strong = cra("strong");
const pre = cra("pre");
const option = cra("option");
const selectEl = cra("select");
const ul = cra("ul");
const li = cra("li");
const table = cra("table");
const tbody = cra("tbody");
const thead = cra("thead");
const tr = cra("tr");
const th = cra("th");
const td = cra("td");
const a = cra("a");
const label = cra("label");
const small = cra("small");
const p = cra("p");
const loading_svg = () => {
  const l = document.createElement("span");
  l.innerHTML =
    '<div class="spinner-border spinner-border-sm text-primary" role="status"><span class="sr-only">Loading...</span></div>';
  return l;
};
function syntaxHighlight(json: any) {
  if (typeof json === "string") {
    try {
      json = JSON.parse(json);
    } catch (e) {
      return `<pre>${escapeHtml(json)}</pre>`;
    }
  }
  // @ts-ignore
  if (typeof prettyPrintJson === "undefined") {
    return `<pre>${escapeHtml(JSON.stringify(json, null, 2))}</pre>`;
  }
  // @ts-ignore
  return prettyPrintJson.toHtml(json, {
    indent: 2,
    lineNumbers: false,
    linkUrls: true,
    linksNewTab: true,
    quoteKeys: true,
    trailingCommas: false,
  });
}
function escapeHtml(unsafe: string) {
  return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(
    />/g,
    "&gt;",
  ).replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function showToast(message: string) {
  const toastContainer = document.getElementById("toast-container");
  if (!toastContainer) return;
  const toast = div({ className: "toast-message" }, message);
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}
function copyToClipboard(text: string, type: string) {
  navigator.clipboard.writeText(text).then(() =>
    showToast(`${type} copied to clipboard!`)
  ).catch((err) => {
    console.error("Failed to copy: ", err);
    showToast(`Failed to copy ${type}.`);
  });
}

// --- ENVIRONMENT SWITCHER ---
function createEnvironmentSelector() {
  const container = document.getElementById("env-switcher-container");
  if (!container) return;
  const label = h3(
    { style: { marginRight: "8px", fontWeight: "500" } },
    "Environment:",
  );
  const selector = selectEl({
    id: "env-selector",
    className: "form-control form-control-sm d-inline-block",
    style: { width: "auto", minWidth: "200px" },
    onchange: (e: any) => {
      currentBaseUrl = e.target.value;
      renderApiEndpoints();
    },
  });
  Object.entries(environments).forEach(([name, url]) => {
    selector.appendChild(option({ value: url }, name));
  });
  selector.value = currentBaseUrl;
  container.appendChild(label);
  container.appendChild(selector);
}

// --- REQUEST HISTORY ---
function saveToHistory(
  method: string,
  url: string,
  status: number,
  payloadSummary: string,
  time: string,
) {
  const timestamp = new Date().toISOString();
  requestHistory.unshift({
    method,
    url,
    status,
    timestamp,
    payloadSummary,
    time,
  });
  if (requestHistory.length > MAX_HISTORY_ITEMS) requestHistory.pop();
  localStorage.setItem("jetpathApiHistory", JSON.stringify(requestHistory));
  renderHistory();
}
function renderHistory() {
  let historyContainer = document.getElementById("api-history-container");
  if (!historyContainer) return;
  historyContainer.innerHTML = "";
  historyContainer.appendChild(
    h2({ className: "section-title" }, "Request History"),
  );
  if (requestHistory.length === 0) {
    historyContainer.appendChild(span("No requests in history yet."));
    return;
  }
  const list = ul({ className: "list-group" });
  requestHistory.forEach((item: any) => {
    const listItem = li(
      {
        className:
          "list-group-item list-group-item-action flex-column align-items-start",
        style: { cursor: "pointer" },
        title: "Click to re-populate (basic)",
        onclick: () => {
          tryRepopulateFromHistory(item);
        },
      },
      div(
        { className: "d-flex w-100 justify-content-between" },
        h5(
          { className: "mb-1" },
          `${item.method} ${new URL(item.url).pathname}`,
        ),
        small(
          `${item.time ? item.time + "ms - " : ""}${
            new Date(item.timestamp).toLocaleTimeString()
          }`,
        ),
      ),
      p({
        className: "mb-1",
        style: { fontSize: "0.8rem", wordBreak: "break-all" },
      }, item.url),
      small(
        { className: `status-${item.status < 400 ? "success" : "error"}` },
        `Status: ${item.status}`,
      ),
      item.payloadSummary
        ? small({
          className: "d-block text-muted",
          style: {
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          },
        }, `Payload: ${item.payloadSummary}`)
        : "",
    );
    list.appendChild(listItem);
  });
  historyContainer.appendChild(list);
}
function tryRepopulateFromHistory(historyItem: any) {
  const endpointCard = Array.from(document.querySelectorAll(".card .btn-link"))
    .find((btn) => {
      const cardUrlPath = btn.querySelector(".api-path")?.textContent;
      try {
        return cardUrlPath &&
          cardUrlPath.trim() === new URL(historyItem.url).pathname;
      } catch {
        return false;
      }
    });
  if (endpointCard) {
    const cardId = endpointCard.closest(".card")!.id;
    const collapseTargetId = endpointCard.getAttribute("data-target");
    if (collapseTargetId) {
      // @ts-ignore
      $(collapseTargetId).collapse("show");
      setTimeout(() => { // Wait for collapse animation
        const urlInput = document.getElementById(`url-${cardId}`);
        if (urlInput) (urlInput as HTMLInputElement).value = historyItem.url;
        // Basic payload re-population (can be enhanced)
        if (
          historyItem.payloadSummary &&
          historyItem.payloadSummary.startsWith("{")
        ) {
          try {
            const payloadObj = JSON.parse(historyItem.payloadSummary);
            const payloadTabContent = document.getElementById(
              `request-tab-content-${cardId}`,
            );
            if (payloadTabContent) {
              const bodyPack = payloadTabContent.querySelector(".body-pack");
              if (bodyPack) {
                Object.entries(payloadObj).forEach(([key, value]) => {
                  const inputEl: HTMLInputElement = bodyPack.querySelector(
                    `input[placeholder="Enter ${key}"]`,
                  )!;
                  if (inputEl) {
                    inputEl.value = typeof value === "object"
                      ? JSON.stringify(value)
                      : value as string;
                  }
                });
              }
            }
          } catch (e) {
            console.warn(
              "Could not parse payload from history for re-population",
              e,
            );
          }
        }
        endpointCard.scrollIntoView({ behavior: "smooth", block: "center" });
        showToast("Form populated from history.");
      }, 300);
    }
  } else {
    showToast("Could not find matching API card to re-populate.");
  }
}

// --- API DATA PARSING ---
function parsePayload(packer: HTMLElement) {
  if (!packer) return;
  const result: any = {};
  let isSet = false;
  const divs = Array.from(packer.children);
  divs.forEach((div: any) => {
    const inputEl = div.querySelector("input");
    if (!inputEl) return;
    isSet = true;
    const key = div.querySelector("span")?.textContent?.replace(":", "");
    if (!key) return;
    if (inputEl.type === "file") {
      result[key] = inputEl.files[0];
      return;
    }
    result[key.trim()] = inputEl.value;
  });
  if (!isSet) return;
  return result;
}

function getInputValue(inputEl: HTMLInputElement) {
  if (!inputEl) return undefined;
  if (inputEl.type === "file") {
    return inputEl.files && inputEl.files.length > 0
      ? inputEl.files[0]
      : undefined;
  }
  if (inputEl.type === "number") {
    return inputEl.value === "" ? undefined : Number(inputEl.value);
  }
  if (inputEl.type === "checkbox") return inputEl.checked;
  const val = inputEl.value;
  if (val === "true") return true;
  if (val === "false") return false;
  return val;
}

function parsePayloadData(bodyPackElement: HTMLElement) {
  if (!bodyPackElement) return {};

  function processNode(node: HTMLElement) {
    // Case 1: Simple field (form-group wrapper which is also a data-input for structure)
    if (node.matches(".form-group.data-input")) {
      const inputEl = node.querySelector(
        'input:not([type="button"]), select, textarea',
      ) as HTMLInputElement;
      return getInputValue(inputEl);
    } // Case 2: Object container
    else if (node.dataset?.["obj"] === "true" && node.matches(".data-input")) {
      const objectData: any = {};
      // Children are either .form-group.data-input (simple props) or .data-input (nested obj/arr)
      Array.from(node.children as HTMLCollectionOf<HTMLElement>).forEach(
        (childNode) => {
          if (childNode.matches(".form-group.data-input, .data-input")) {
            // Key is from data-key-name on the span within form-group, or data-holder for nested obj/arr containers
            const key =
              (childNode.querySelector("span[data-key-name]") as HTMLElement)
                ?.dataset?.["keyName"] ||
              (childNode as HTMLElement).dataset?.["holder"];
            if (key) {
              objectData[key] = processNode(childNode);
            }
          }
        },
      );
      return objectData;
    } // Case 3: Array container
    else if (node.dataset?.["arr"] === "true" && node.matches(".data-input")) {
      const arrayData: any = [];
      const arrayItemsContainer = node.querySelector(".array-cont");
      if (arrayItemsContainer) { // Array of objects
        Array.from(arrayItemsContainer.children).filter((item) =>
          item.matches(".array-item")
        ).forEach((itemElement) => {
          const itemObject: any = {};
          // Each field within itemElement is a .form-group.data-input or .data-input (for nested)
          Array.from(itemElement.children as HTMLCollectionOf<HTMLElement>)
            .forEach((fieldNode) => {
              if (fieldNode.matches(".form-group.data-input, .data-input")) {
                const key = (fieldNode.querySelector(
                  "span[data-key-name]",
                ) as HTMLElement)?.dataset?.["keyName"] ||
                  (fieldNode as HTMLElement).dataset?.["holder"];
                if (key) {
                  itemObject[key] = processNode(fieldNode);
                }
              }
            });
          arrayData.push(itemObject);
        });
      } else { // Simple array (comma-separated)
        const simpleArrayInput = node.querySelector(
          'input[type="text"][placeholder*="comma-separated"]',
        ) as HTMLInputElement;
        if (simpleArrayInput) {
          const val = getInputValue(simpleArrayInput);
          if (val && typeof val === "string" && val.trim() !== "") {
            arrayData.push(
              ...val.split(",").map((s) => s.trim()).filter((s) => s),
            );
          } else if (val !== undefined && val !== "" && val !== null) {
            arrayData.push(val);
          }
        }
      }
      return arrayData;
    }
    return undefined;
  }

  const assembledPayload: any = {};
  Array.from(bodyPackElement.children as HTMLCollectionOf<HTMLElement>).forEach(
    (topLevelNode) => {
      // Each topLevelNode is a direct field/object/array from the schema root
      // It should be a .form-group.data-input (simple) or .data-input (complex)
      if (topLevelNode.matches(".form-group.data-input, .data-input")) {
        const key =
          (topLevelNode.querySelector("span[data-key-name]") as HTMLElement)
            ?.dataset?.["keyName"] ||
          (topLevelNode as HTMLElement).dataset?.["holder"];
        if (key) {
          assembledPayload[key] = processNode(topLevelNode);
        }
        // @ts-ignore
        console.log(key, assembledPayload[key]);
      }
    },
  );
  return assembledPayload;
}
function parsePayloadStructure(
  apiSchema: any,
  cardId: string,
  isPayload = true,
) {
  if (!apiSchema) return;
  const packer = div({ className: "body-pack" });
  function createInputField(
    key: string,
    valueSchema: any,
    _type: string,
    _holder: string,
    currentPath = "",
  ) {
    const fieldId = `${cardId}-field-${
      (currentPath + key).replace(/[^a-zA-Z0-9]/g, "_")
    }`;
    if (
      typeof valueSchema === "object" && !Array.isArray(valueSchema) &&
      valueSchema !== null
    ) {
      const nestedDiv = div(
        {
          className: "data-input",
          "data-obj": "true",
          "data-holder": key,
          style: {
            marginLeft: "15px",
            borderLeft: "2px solid var(--surface-3)",
            paddingLeft: "10px",
            marginBottom: "10px",
          },
        },
        h5(
          { style: { fontSize: "0.9em", color: "var(--text-secondary)" } },
          key + ": {object}",
        ),
      );
      Object.entries(valueSchema ?? {}).forEach(([nestedKey, nestedValue]) => {
        nestedDiv.appendChild(
          createInputField(
            nestedKey,
            nestedValue,
            "obj",
            key,
            currentPath + key + ".",
          ),
        );
      });
      return nestedDiv;
    } else if (Array.isArray(valueSchema)) {
      const arrayDiv = div(
        {
          className: "data-input",
          "data-arr": "true",
          "data-holder": key,
          style: {
            marginLeft: "15px",
            borderLeft: "2px solid var(--surface-3)",
            paddingLeft: "10px",
            marginBottom: "10px",
          },
        },
        h5(
          { style: { fontSize: "0.9em", color: "var(--text-secondary)" } },
          key + ": [array]",
        ),
      );
      if (
        valueSchema.length > 0 && typeof valueSchema[0] === "object" &&
        valueSchema[0] !== null
      ) {
        const arrayContainer = div({ className: "array-cont" });
        arrayDiv.appendChild(arrayContainer);
        let pos = 0;
        const addItem = () => {
          const itemDiv = div({
            className: "array-item",
            "data-pos": pos,
            style: {
              border: "1px dashed var(--border-color)",
              padding: "10px",
              marginBottom: "5px",
            },
          });
          Object.entries(valueSchema).forEach(([arrayKey, arrayValue]) => {
            itemDiv.appendChild(
              createInputField(
                arrayKey,
                arrayValue,
                "arr-obj",
                key,
                `${currentPath}${key}[${pos}].`,
              ),
            );
          });
          arrayContainer.appendChild(itemDiv);
          pos += 1;
        };
        addItem();
        arrayDiv.appendChild(
          button("+ Add Item", {
            onclick: addItem,
            className: "btn btn-sm btn-outline-secondary",
            style: { fontSize: "0.8rem", marginTop: "5px" },
          }),
        );
      } else {
        arrayDiv.appendChild(
          span(
            { "data-key-name": key, style: { marginRight: "5px" } },
            key + ": ",
          ),
        );
        arrayDiv.appendChild(
          input({
            type: valueSchema[0].split(":")[0],
            id: fieldId,
            placeholder: "Enter " + key + " (comma-separated values)",
            value: valueSchema[0].split(":")[1],
            className: "form-control form-control-sm",
          }),
        );
      }
      return arrayDiv;
    } else {
      let [type, value] = typeof valueSchema === "string"
        ? valueSchema.split(":")
        : [valueSchema, null];
      if (!isPayload) value = valueSchema;
      return div(
        {
          className: "form-group row data-input",
          style: { marginBottom: "0.5rem" },
        },
        span({
          htmlFor: fieldId,
          className: "col-sm-4 col-form-label col-form-label-sm",
          "data-key-name": key,
          style: { fontWeight: "normal" },
        }, key + ": "),
        div(
          { className: "col-sm-8" },
          input({
            type:
              /(file|number|string|date|datetime|time|email|url|tel|password|checkbox|radio|select|textarea|hidden|button|submit|reset|image|color|month|week|range)/
                  .test(type)
                ? type
                : "text",
            id: fieldId,
            value: type !== "file" && value !== null ? value : null,
            placeholder: "Enter " + key,
            className: "form-control form-control-sm",
          }),
        ),
      );
    }
  }
  if (apiSchema && typeof apiSchema === "object") {
    Object.entries(apiSchema).forEach(([key, value]) => {
      packer.appendChild(createInputField(key, value, "root", ""));
    });
  } else if (apiSchema) {
    packer.appendChild(
      span(
        "Payload schema is not a valid object. Raw: " +
          escapeHtml(String(apiSchema)),
      ),
    );
  } else {packer.appendChild(
      span("No payload schema defined for this request."),
    );}
  return packer;
}
function parseApiDocumentation(apiDocString: string) {
  const requests = apiDocString.split("###").map((request) => request.trim())
    .filter((a) => a !== "");
  return requests.map(parseRequest);
}
function parseRequest(requestString: string) {
  const lines = requestString.split("\\n").map((line) => line.trim());
  const requestLine = lines[0].split(" ");
  const method = requestLine[0];
  const url = requestLine[1];
  const httpVersion = requestLine[2];
  const headers: any = {};
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "") break;
    const [key, value] = lines[i].split(":").map((part) => part.trim());
    headers[key.toLowerCase()] = value;
  }
  const payloadIndex = lines.indexOf("") + 1;
  let payload = payloadIndex !== 0
    ? lines.slice(payloadIndex).join("\\n")
    : null;
  let comment = "";
  if (payload?.includes("#")) {
    comment = payload.slice(payload.indexOf("#") + 1, payload.indexOf("-JETE"));
    payload = payload.replace(["#", comment, "-JETE"].join(""), "");
  }
  return { method, url, httpVersion, headers, payload, comment };
}
const groupByFirstFeature = (apis: any[]) => {
  const results: any = {};
  const out: any[] = [];
  for (let a = 0; a < apis.length; a++) {
    const api = apis[a];
    try {
      const top_path = new URL(api?.url).pathname.split("/")[1] || "/";
      if (results[top_path]) results[top_path].push(api);
      else results[top_path] = [api];
      results[top_path].sort((x: any, y: any) => x.url.localeCompare(y.url));
    } catch (e) {
      console.warn("Skipping API with invalid URL:", api);
      continue;
    }
  }
  for (const apilist in results) {
    out.push({ comment: apilist, isGroup: true });
    out.push(...results[apilist]);
  }
  return out;
};

// --- RESPONSE HANDLING ---
function showApiResponse(
  response: any,
  cardId: string,
  expectedStatusCode: number,
  expectedBodyContains: string,
  startTime: number,
) {
  const endTime = performance.now();
  const requestTime = (endTime - startTime).toFixed(0);
  const responseSize = response.body
    ? new TextEncoder().encode(response.body).length
    : 0; // Bytes

  const responseBodyTab = document.getElementById(
    `response-body-tab-${cardId}`,
  );
  const responseHeadersTab = document.getElementById(
    `response-headers-tab-${cardId}`,
  );
  const testResultsTab = document.getElementById(`test-results-tab-${cardId}`);
  const responseMetaInfo = document.getElementById(`response-meta-${cardId}`);

  if (
    !responseBodyTab || !responseHeadersTab || !testResultsTab ||
    !responseMetaInfo
  ) return;

  responseMetaInfo.innerHTML = "";
  responseMetaInfo.appendChild(
    span(
      {
        className: `status-${
          response.status < 400 && !response.error ? "success" : "error"
        }`,
      },
      `Status: ${response.status || (response.error ? "Client Error" : "N/A")}`,
    ),
  );
  responseMetaInfo.appendChild(span(`Time: ${requestTime} ms`));
  responseMetaInfo.appendChild(
    span(`Size: ${(responseSize / 1024).toFixed(2)} KB`),
  );

  // Body Tab
  responseBodyTab.innerHTML = "";
  if (response.body) {
    responseBodyTab.appendChild(
      button({
        className: "btn btn-sm btn-outline-secondary float-right mb-2",
        onclick: () => copyToClipboard(response.body, "Response Body"),
      }, "Copy Body"),
    );
    responseBodyTab.appendChild(
      div({
        className: "code-container",
        style: { overflowX: "auto" },
        innerHTML: syntaxHighlight(response.body),
      }),
    );
  } else {
    responseBodyTab.appendChild(span(response.error || "No response body."));
  }

  // Headers Tab
  responseHeadersTab.innerHTML = "";
  if (response.headers && typeof response.headers.forEach === "function") {
    const headersTable = table({ className: "table table-sm headers-table" });
    const tHead = thead(tr(th("Header Name"), th("Header Value")));
    const tBody = tbody();
    response.headers.forEach((value: string, name: string) => {
      tBody.appendChild(tr(td(name), td(value)));
    });
    headersTable.appendChild(tHead);
    headersTable.appendChild(tBody);
    responseHeadersTab.appendChild(headersTable);
  } else {
    responseHeadersTab.appendChild(span("No headers in response."));
  }

  // Test Results Tab
  testResultsTab.innerHTML = "";
  // @ts-ignore
  let allAssertionsPassed = true;
  if (expectedStatusCode) {
    const statusCode = response.status || (response.error ? 0 : 404);
    const statusPass = Number(expectedStatusCode) === statusCode;
    if (!statusPass) allAssertionsPassed = false;
    testResultsTab.appendChild(
      div(
        {
          className: `assertion-result ${
            statusPass ? "assertion-pass" : "assertion-fail"
          }`,
        },
        `Status Code: Expected ${expectedStatusCode}, Got ${statusCode}. (${
          statusPass ? "PASS" : "FAIL"
        })`,
      ),
    );
  }
  if (expectedBodyContains && response.body) {
    const bodyPass = response.body.includes(expectedBodyContains);
    if (!bodyPass) allAssertionsPassed = false;
    testResultsTab.appendChild(
      div(
        {
          className: `assertion-result ${
            bodyPass ? "assertion-pass" : "assertion-fail"
          }`,
        },
        `Body Contains "${expectedBodyContains}": ${
          bodyPass ? "Found (PASS)" : "Not Found (FAIL)"
        }`,
      ),
    );
  }
  if (!expectedStatusCode && !expectedBodyContains) {
    testResultsTab.appendChild(span("No assertions defined for this request."));
  }

  document.getElementById(`response-container-tabs-${cardId}`)!.style.display =
    "block";
  const tabToActivate = (expectedStatusCode || expectedBodyContains)
    ? `test-results-nav-${cardId}`
    : `response-body-nav-${cardId}`;
  // @ts-ignore
  $(`#${tabToActivate}`).tab("show");
}

// --- API CARD RENDERING & ACTIONS ---
function createApiCard(request: any, i: number) {
  const payloadSchema = JSON.parse(
    request.payload?.includes("{") ? request.payload : "null",
  );
  const cardIdSuffix = request.method.toLowerCase() +
    (request.url.replace(/[^a-zA-Z0-9]/g, "")) + i; // More unique ID
  const cardId = `card-${cardIdSuffix}`;
  const collapseId = `collapse-${cardIdSuffix}`;

  const requestTabs = ul(
    { className: "nav nav-tabs", role: "tablist" },
    li(
      { className: "nav-item" },
      a({
        className: "nav-link active",
        id: `request-nav-${cardId}`,
        "data-toggle": "tab",
        href: `#request-tab-content-${cardId}`,
        role: "tab",
      }, "Request"),
    ),
    li(
      { className: "nav-item" },
      a({
        className: "nav-link",
        id: `auth-nav-${cardId}`,
        "data-toggle": "tab",
        href: `#auth-tab-content-${cardId}`,
        role: "tab",
      }, "Global Auth"),
    ),
    li(
      { className: "nav-item" },
      a({
        className: "nav-link",
        id: `assertions-nav-${cardId}`,
        "data-toggle": "tab",
        href: `#assertions-tab-content-${cardId}`,
        role: "tab",
      }, "Assertions"),
    ),
    li(
      { className: "nav-item" },
      a({
        className: "nav-link",
        id: `curl-nav-${cardId}`,
        "data-toggle": "tab",
        href: `#curl-tab-content-${cardId}`,
        role: "tab",
      }, "cURL"),
    ),
  );
  const requestTabsContent = div(
    { className: "tab-content" },
    div(
      {
        className: "tab-pane fade show active",
        id: `request-tab-content-${cardId}`,
        role: "tabpanel",
      },
      div(
        { className: "form-group mt-3" },
        label({ htmlFor: `url-${cardId}` }, "Request URL"),
        input({
          className: "form-control url-input",
          id: `url-${cardId}`,
          value: request.url,
        }),
      ),
      div(
        { className: "form-group" },
        label({ htmlFor: `content-type-dropdown-${cardId}` }, "Content-Type"),
        selectEl(
          {
            id: `content-type-dropdown-${cardId}`,
            className: "form-control form-control-sm",
          },
          option({ value: "application/json" }, "JSON"),
          option({ value: "multipart/form-data" }, "Form Data"),
          option(
            { value: "application/x-www-form-urlencoded" },
            "Form URL Encoded",
          ),
        ),
      ),
      $if(payloadSchema, () =>
        div(
          { className: "payload-section" },
          strong("Payload:"),
          parsePayloadStructure(payloadSchema, cardId),
        )),
    ),
    div(
      {
        className: "tab-pane fade",
        id: `auth-tab-content-${cardId}`,
        role: "tabpanel",
      },
      div({
        className: "global-auth-section mt-3",
        id: `global-auth-preview-${cardId}`,
      }, strong("Global Authentication Headers (Read-only):")),
    ),
    div(
      {
        className: "tab-pane fade",
        id: `assertions-tab-content-${cardId}`,
        role: "tabpanel",
      },
      div(
        { className: "form-group mt-3" },
        label({ htmlFor: `expected-status-${cardId}` }, "Expected Status Code"),
        input({
          type: "number",
          id: `expected-status-${cardId}`,
          placeholder: "e.g., 200",
          className: "form-control form-control-sm",
        }),
      ),
      div(
        { className: "form-group" },
        label(
          { htmlFor: `expected-body-${cardId}` },
          "Response Body Contains (Text)",
        ),
        input({
          type: "text",
          id: `expected-body-${cardId}`,
          placeholder: 'e.g., "success": true',
          className: "form-control form-control-sm",
        }),
      ),
    ),
    div(
      {
        className: "tab-pane fade",
        id: `curl-tab-content-${cardId}`,
        role: "tabpanel",
      },
      div(
        { className: "mt-3 curl-output", id: `curl-output-${cardId}` },
        pre('Click "Generate cURL" after configuring request.'),
      ),
    ),
  );

  const responseSectionTabs = ul(
    { className: "nav nav-tabs mt-3", role: "tablist" },
    li(
      { className: "nav-item" },
      a({
        className: "nav-link active",
        id: `response-body-nav-${cardId}`,
        "data-toggle": "tab",
        href: `#response-body-tab-${cardId}`,
        role: "tab",
      }, "Body"),
    ),
    li(
      { className: "nav-item" },
      a({
        className: "nav-link",
        id: `response-headers-nav-${cardId}`,
        "data-toggle": "tab",
        href: `#response-headers-tab-${cardId}`,
        role: "tab",
      }, "Headers"),
    ),
    li(
      { className: "nav-item" },
      a({
        className: "nav-link",
        id: `test-results-nav-${cardId}`,
        "data-toggle": "tab",
        href: `#test-results-tab-${cardId}`,
        role: "tab",
      }, "Test Results"),
    ),
  );
  const responseSectionTabsContent = div(
    { className: "tab-content" },
    div({
      className: "tab-pane fade show active",
      id: `response-body-tab-${cardId}`,
      role: "tabpanel",
      style: { padding: "10px", flexDirection: "column" },
    }),
    div({
      className: "tab-pane fade",
      id: `response-headers-tab-${cardId}`,
      role: "tabpanel",
      style: { padding: "10px" },
    }),
    div({
      className: "tab-pane fade",
      id: `test-results-tab-${cardId}`,
      role: "tabpanel",
      style: { padding: "10px" },
    }),
  );

  const clearForm = () => {
    const requestTab = document.getElementById(`request-tab-content-${cardId}`);
    if (requestTab) {
      requestTab.querySelectorAll(
        'input[type="text"], input[type="number"], input[type="file"], textarea',
      ).forEach((inp: any) => inp.value = "");
      requestTab.querySelectorAll('input[type="checkbox"], input[type="radio"]')
        .forEach((inp: any) => inp.checked = false);
    }
    (document.getElementById(`expected-status-${cardId}`) as HTMLInputElement)
      .value = "";
    (document.getElementById(`expected-body-${cardId}`) as HTMLInputElement)
      .value = "";
    document.getElementById(`response-meta-${cardId}`)!.innerHTML = "";
    document.getElementById(`response-body-tab-${cardId}`)!.innerHTML = "";
    document.getElementById(`response-headers-tab-${cardId}`)!.innerHTML = "";
    document.getElementById(`test-results-tab-${cardId}`)!.innerHTML = "";
    document.getElementById(`curl-output-${cardId}`)!.querySelector("pre")!
      .textContent = 'Click "Generate cURL" after configuring request.';
    showToast("Form cleared.");
  };

  const generateCurlAction = () => {
    const method = request.method.toUpperCase();
    const url = (document.getElementById(`url-${cardId}`) as HTMLInputElement)
      ?.value?.trim();
    const globalHeaders = parsePayload(document.getElementById("keys")!) || {};
    const specificHeaders = request.headers; // From API doc
    const allHeaders = { ...specificHeaders, ...globalHeaders };
    let curlCommand = `curl --location --request ${method} '${url}' \\\n`;
    for (const key in allHeaders) {
      if (Object.hasOwnProperty.call(allHeaders, key)) {
        curlCommand += `--header '${key}: ${allHeaders[key]}' \\\n`;
      }
    }
    const payloadData = parsePayloadData(
      document.getElementById(`request-tab-content-${cardId}`)!.querySelector(
        ".body-pack",
      )!,
    );
    const contentType = (document.getElementById(
      `content-type-dropdown-${cardId}`,
    ) as HTMLInputElement)?.value ||
      "application/json";

    if (payloadData && Object.keys(payloadData).length > 0) {
      curlCommand += `--header 'Content-Type: ${contentType}' \\\n`;
      if (contentType === "application/json") {
        curlCommand += `--data-raw '${JSON.stringify(payloadData)}'`;
      } else if (contentType === "multipart/form-data") {
        for (const key in payloadData) {
          curlCommand += `--form '${key}=${
            payloadData[key] instanceof File
              ? payloadData[key].name
              : JSON.stringify(payloadData[key])
          }' \\\n`;
        }
        curlCommand = curlCommand.slice(0, -4);
      } else if (contentType === "application/x-www-form-urlencoded") {
        curlCommand += `--data-raw '${
          new URLSearchParams(payloadData).toString()
        }'`;
      }
    } else if (curlCommand.endsWith(" \\\n")) curlCommand = curlCommand;

    const curlOutputPre = document.getElementById(`curl-output-${cardId}`)!
      .querySelector("pre")!;
    curlOutputPre.textContent = curlCommand;
    // Add copy button if not exists, or just make sure it's visible
    let copyBtn = document.getElementById(`copy-curl-${cardId}`);
    if (!copyBtn && curlOutputPre.parentNode) {
      copyBtn = button({
        id: `copy-curl-${cardId}`,
        className: "btn btn-sm btn-outline-secondary mt-2",
        onclick: () => copyToClipboard(curlCommand, "cURL command"),
      }, "Copy cURL");
      curlOutputPre.parentNode.appendChild(copyBtn!);
    }
    // @ts-ignore
    $(`#curl-nav-${cardId}`).tab("show"); // Switch to cURL tab
  };

  const sendRequestAction = async () => {
    const startTime = performance.now();
    const currentUrl =
      (document.getElementById(`url-${cardId}`) as HTMLInputElement)?.value
        ?.trim();
    const globalAuthHeaders = parsePayload(document.getElementById("keys")!) ||
      {};
    const requestSpecificHeaders = request.headers;
    const combinedHeaders = { ...requestSpecificHeaders, ...globalAuthHeaders };
    const payloadData = parsePayloadData(
      document.getElementById(`request-tab-content-${cardId}`)!.querySelector(
        ".body-pack",
      )!,
    );
    const expectedStatusCode = (document.getElementById(
      `expected-status-${cardId}`,
    ) as HTMLInputElement)?.value;
    const expectedBodyContent = (document.getElementById(
      `expected-body-${cardId}`,
    ) as HTMLInputElement)?.value;
    const contentType = (document.getElementById(
      `content-type-dropdown-${cardId}`,
    ) as HTMLInputElement)?.value ||
      "application/json";

    const responseContainerTabs = document.getElementById(
      `response-container-tabs-${cardId}`,
    );
    responseContainerTabs!.style.display = "block"; // Show response area
    document.getElementById(`response-meta-${cardId}`)!.innerHTML = "";
    document.getElementById(`response-body-tab-${cardId}`)!.innerHTML = "";
    document.getElementById(`response-headers-tab-${cardId}`)!.innerHTML = "";
    document.getElementById(`test-results-tab-${cardId}`)!.innerHTML = "";
    document.getElementById(`response-body-tab-${cardId}`)!.appendChild(
      loading_svg(),
    ); // Show loader in body tab

    const apiResponse = await testApi(
      request.method,
      currentUrl,
      combinedHeaders,
      payloadData,
      contentType,
    );
    showApiResponse(
      apiResponse,
      cardId,
      Number(expectedStatusCode),
      expectedBodyContent,
      startTime,
    );

    if (!apiResponse.error) {
      let payloadSummary = "";
      if (payloadData && Object.keys(payloadData).length > 0) {
        payloadSummary = JSON.stringify(payloadData).substring(0, 70) +
          (JSON.stringify(payloadData).length > 70 ? "..." : "");
      }
      saveToHistory(
        request.method,
        currentUrl,
        apiResponse.status,
        payloadSummary,
        (performance.now() - startTime).toFixed(0),
      );
    }
  };

  return div(
    { className: "card", id: cardId },
    div(
      { className: "card-header", id: `header-${cardId}` },
      h5(
        { className: "mb-0" },
        button(
          {
            className: "btn btn-link collapsed",
            type: "button",
            "data-toggle": "collapse",
            "data-target": `#${collapseId}`,
            "aria-expanded": "false",
            "aria-controls": collapseId,
            onclick: () => { // Populate global auth preview when card expands
              const authPreview = document.getElementById(
                `global-auth-preview-${cardId}`,
              );
              if (authPreview && authPreview.children.length <= 1) { // Only populate if empty (except for title)
                const globalHeaders = parsePayload(
                  document.getElementById("keys") as HTMLInputElement,
                );
                console.log(globalHeaders, "?");
                if (globalHeaders && Object.keys(globalHeaders).length > 0) {
                  Object.entries(globalHeaders).forEach(([key, value]) => {
                    authPreview.appendChild(
                      div(
                        { style: { fontSize: "0.85rem" } },
                        strong(key + ": "),
                        span(value),
                      ),
                    );
                  });
                } else {
                  authPreview.appendChild(
                    span(
                      { style: { fontSize: "0.85rem" } },
                      "No global authentication headers configured or found.",
                    ),
                  );
                }
              }
            },
          },
          span(request.method, { className: "method " + request.method }),
          span(
            { className: "api-path" },
            request.url ? new URL(request.url).pathname : "Invalid URL",
          ), // Display path
          span({
            className: "text-muted small ml-2",
            style: { fontWeight: "normal" },
          }, request.comment || ""),
        ),
      ),
    ),
    div(
      {
        id: collapseId,
        className: "collapse",
        "data-parent": "#api-endpoint-container",
      },
      div(
        { className: "card-body" },
        requestTabs,
        requestTabsContent,
        div(
          { className: "action-buttons mt-3 mb-3" },
          button("Send Request", {
            className: "btn btn-primary",
            onclick: sendRequestAction,
          }),
          button("Generate cURL", {
            className: "btn btn-secondary",
            onclick: generateCurlAction,
          }),
          button("Clear Form", {
            className: "btn btn-outline-danger btn-sm",
            onclick: clearForm,
          }),
        ),
        div({ id: `response-meta-${cardId}`, className: "response-meta" }),
        div(
          {
            id: `response-container-tabs-${cardId}`,
            style: { display: "none" },
          },
          responseSectionTabs,
          responseSectionTabsContent,
        ),
      ),
    ),
  );
}

function renderApiEndpoints() {
  const apiEndpointContainer = document.getElementById(
    "api-endpoint-container",
  );
  const searchInput = document.getElementById(
    "api-search-input",
  ) as HTMLInputElement;
  if (!apiEndpointContainer || !searchInput) return;

  const searchTerm = searchInput.value.toLowerCase();
  apiEndpointContainer.innerHTML = "";

  const apiDocumentation = apiDocumentationRawTemplate.replaceAll(
    "[--host--]",
    currentBaseUrl,
  );
  const parsedApis = parseApiDocumentation(apiDocumentation);

  let visibleApis = parsedApis;
  if (searchTerm) {
    visibleApis = parsedApis.filter((api) => {
      const fullText = `${api.method} ${api.url} ${api.comment || ""}`
        .toLowerCase();
      return fullText.includes(searchTerm);
    });
  }

  const groupedApis = groupByFirstFeature(visibleApis);
  if (groupedApis.length === 0 && searchTerm) {
    apiEndpointContainer.appendChild(
      div(
        { className: "alert alert-warning" },
        "No endpoints match your search.",
      ),
    );
    return;
  } else if (groupedApis.length === 0) {
    apiEndpointContainer.appendChild(
      div(
        { className: "alert alert-info" },
        "No API endpoints defined or an error occurred parsing them.",
      ),
    );
    return;
  }

  groupedApis.forEach((item: any, i) => {
    if (item.isGroup) {
      const groupTitle = h4({
        className: "mt-3 mb-2 text-muted px-2",
        style: {
          fontSize: "1rem",
          borderBottom: "1px solid var(--surface-3)",
          paddingBottom: "5px",
        },
      }, item.comment.toUpperCase());
      apiEndpointContainer.appendChild(groupTitle);
    } else {
      apiEndpointContainer.appendChild(createApiCard(item, i));
    }
  });
}

async function testApi(
  method: string,
  url: string,
  headers: Record<string, string> = {},
  body: any,
  contentType = "application/json",
) {
  if (
    contentType !== "multipart/form-data" &&
    contentType !== "application/octet-stream"
  ) headers["Content-Type"] = contentType;
  else if (contentType === "multipart/form-data") {
    delete headers["Content-Type"];
  }
  let response;
  try {
    const fetchOptions = {
      method,
      headers,
      signal: AbortSignal.timeout(30000),
      body,
    }; // 30s timeout
    if (method !== "GET" && method !== "HEAD" && body !== undefined) {
      if (contentType === "application/json") {
        fetchOptions.body = JSON.stringify(body);
      } else if (contentType === "multipart/form-data") {
        const formData = new FormData();
        if (body) { for (const key in body) formData.append(key, body[key]); }
        fetchOptions.body = formData;
      } else if (contentType === "application/x-www-form-urlencoded") {
        fetchOptions.body = new URLSearchParams(body).toString();
      } else fetchOptions.body = body;
    } else {
      delete fetchOptions.body;
    }
    console.log(fetchOptions, body);
    response = await fetch(url, fetchOptions);
    const responseBody = await response.text();
    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of response.headers.entries()) {
      responseHeaders[key] = value;
    }
    return {
      status: response.status,
      headers: response.headers,
      body: responseBody,
    };
  } catch (error: any) {
    console.error("API Test Error:", error);
    return {
      error: error.message,
      status: 0,
      body: error.message,
      headers: new Headers(),
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  createEnvironmentSelector();
  try {
    document.getElementById("keys")?.appendChild(
      parsePayloadStructure(
        JSON.parse(apiGlobalHeadersRaw),
        "global-headers",
        false,
      ),
    );
  } catch (e) {
    console.error(
      "Failed to parse global headers JSON:",
      apiGlobalHeadersRaw,
      e,
    );
  }
  renderApiEndpoints();
  renderHistory();

  const searchInput: any = document.getElementById("api-search-input");
  if (searchInput) {
    searchInput.addEventListener("keyup", () => {
      clearTimeout(searchInput.searchTimeout);
      searchInput.searchTimeout = setTimeout(renderApiEndpoints, 300);
    });
  }
});
