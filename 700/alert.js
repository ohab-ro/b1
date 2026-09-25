/* Copyright (C) 2023-2025 anonymous

This file is part of PSFree.

PSFree is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

PSFree is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.  */

// We can't just open a console on the ps4 browser, make sure the errors thrown
// by our program are alerted.

// We don't use a custom logging function to avoid a dependency on a logging
// module since we want this file to stand alone. We don't want to copy the
// log function here either for the sake avoiding dependencies since using
// alert() is good enough.

// We log the line and column numbers as well since some exceptions (like
// SyntaxError) do not show it in the stack trace.

function formatError(reason) {
  if (reason && typeof reason === "object") {
    const source = reason.sourceURL || reason.fileName || "";
    const line = reason.lineNumber != null ? reason.lineNumber : reason.line;
    const column = reason.columnNumber != null ? reason.columnNumber : reason.column;
    const location = source ? " at " + source + (line != null ? ":" + line : "") + (column != null ? ":" + column : "") : "";
    return String(reason.stack || reason.message || reason) + location;
  }
  return String(reason);
}

// STABLE HOST PATCH (r4): never block the page with alert().
//
// A blocking modal in the PS4 browser looks exactly like a frozen console and it
// steals the timing window the chain needs. Errors now go to the hidden
// #console log and to the host shell, which classifies them: pre-kernel errors
// allow a safe page reload, post-kernel errors require a console reboot.
function note2host(text) {
  try {
    if (typeof window.__ohabTechHostNote === "function") window.__ohabTechHostNote(text);
  } catch (ignore) {}
  try {
    let el = document.getElementById("console");
    if (!el) {
      el = document.createElement("pre");
      el.id = "console";
      el.setAttribute(
        "style",
        "position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;" +
          "overflow:hidden;opacity:0;pointer-events:none;"
      );
      (document.body || document.documentElement).appendChild(el);
    }
    el.append(text + "\n");
    if (el.childNodes.length > 600) {
      for (let i = 0; i < 200 && el.firstChild; i++) el.removeChild(el.firstChild);
    }
  } catch (ignore) {}
}

function reportError(kind, event) {
  const reason = event && (event.reason || event.error || event.message);
  const text = kind + ": " + formatError(reason || "Unknown error");
  note2host(text);
  // a failed <img>/<link> is a resource error, not a chain failure
  const isResourceError = !!(event && event.target && event.target.tagName && !event.message);
  if (isResourceError || !reason) return;
  try {
    if (typeof window.__ohabTechHostFailure === "function") {
      window.__ohabTechHostFailure(text, "webkit");
    }
  } catch (ignore) {}
}

addEventListener("unhandledrejection", (event) => {
  reportError("Unhandled rejection", event);
});

addEventListener("error", (event) => {
  reportError("Unhandled error", event);
  return true;
});

// we have to dynamically import the program if we want to catch its syntax
// errors
import("./psfree.js").catch(function (reason) {
    if (typeof window.__ohabTechHostFailure === "function") {
        window.__ohabTechHostFailure("The 7.x exploit module stopped unexpectedly.");
    }
    reportError("Module load failed", { reason: reason });
});
