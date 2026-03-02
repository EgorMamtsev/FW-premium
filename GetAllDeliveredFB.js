// ==UserScript==
// @name         GetAllDeliveredFB new
// @namespace    http://tampermonkey.net/
// @version      2025-05-28
// @description  giving all FB in delivered tab
// @author       You
// @match        https://erp.gologity.com/freight-watch/delivered
// @icon         https://www.google.com/s2/favicons?sz=64&domain=gologity.com
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  function waitForElement(selector) {
    return new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    });
  }

  waitForElement("div.m-b-2").then(init);

  function init() {
    const toggleGroup = document.querySelector("mat-button-toggle-group");
    if (!toggleGroup) return;

    const toggle = document.createElement("mat-button-toggle");
    toggle.className =
      "mat-button-toggle button-toggle mat-button-toggle-appearance-standard ng-star-inserted";

    toggle.innerHTML = `
      <span class="mat-button-toggle-focus-overlay"></span>
      <span class="mat-ripple mat-button-toggle-ripple"></span>
      <button class="mat-button-toggle-button mat-focus-indicator">
        <span class="mat-button-toggle-label-content">
          <div class="d-flex align-items-center">
            <span>Get all FB</span>
          </div>
        </span>
      </button>
    `;

    toggleGroup.append(toggle);

    toggle.querySelector("button").addEventListener("click", getAllFB);
  }

  function getAllFB() {
    const rows = document.querySelectorAll("tbody tr");
    const fbArr = [...rows].map((row) =>
      Number(row.children[2]?.textContent.trim()),
    );

    const input = document.querySelector("input.mat-mdc-input-element");
    if (input) input.value = fbArr.join(",");
  }
})();
