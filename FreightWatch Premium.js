// ==UserScript==
// @name         Freight Watch Premium
// @namespace    http://tampermonkey.net/
// @version      2026-02-17
// @description  Stable version: init, cleanup old FB, restore updated class, modular saveLoad
// @author       You
// @match        https://erp.gologity.com/freight-watch/dispatch
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  //#region consts операційні змінні
  const FUTURES = {
    countUpdates: true,
    markUpdates: true,
    comments: true,
    renderCounter: true,
  };

  let cleaneDone = false;

  //#endregion

  //#region getFunctions
  function getTbody() {
    return document.querySelector("tbody");
  }

  function getSaveBtn() {
    return document.querySelector("button.m-l-4");
  }

  function getEditBtn() {
    return document
      .querySelector("div.stops-wrapper")
      .querySelector("button.lgt-button-white");
  }

  function getComentField() {
    return document
      .querySelector("div.post-comment")
      .querySelector("textarea.cdk-textarea-autosize");
  }

  function getPostComentBtn() {
    return document
      .querySelector("lgt-form-actions.fit")
      .querySelector("button.lgt-button-primary");
  }

  //#endregion

  //#region Mark and Count updates

  // Ініціалізація локалсторедж
  function initUpdated() {
    let updatedLoads = localStorage.getItem("updated");

    if (!updatedLoads) {
      updatedLoads = { updates: 0, loads: 0, updated: [] };
      localStorage.setItem("updated", JSON.stringify(updatedLoads));
    } else {
      updatedLoads = JSON.parse(updatedLoads);
    }

    return updatedLoads;
  }

  // Викликаємо завжди, навіть якщо countUpdates=false або markUpdates=false
  let updatedState = initUpdated();

  // Функція для підсвітки рядків
  function restoreUpdatedRows(updatedState) {
    if (!FUTURES.markUpdates) {
      return;
    }
    if (!getTbody()) {
      return;
    }

    const rows = Array.from(getTbody().children);

    rows.forEach((row) => {
      const fb = Number(row.children[1].textContent);

      if (
        updatedState.updated.includes(fb) &&
        !row.children[1].classList.contains("updated")
      ) {
        row.children[1].classList.add("updated");
      }
    });
  }

  //видаляє фб яких вже не має на сторінці
  function removerMissingLoads() {
    const tbody = getTbody();
    if (!tbody) return;

    const rows = Array.from(tbody.children);

    // FB які є зараз на сторінці
    const fbOnPage = rows.map((row) =>
      Number(row.children[1].textContent.trim()),
    );

    updatedState = initUpdated();

    const before = updatedState.updated.length;

    // залишаємо тільки ті FB, які ще є на сторінці
    updatedState.updated = updatedState.updated.filter((fb) =>
      fbOnPage.includes(Number(fb)),
    );

    if (before !== updatedState.updated.length) {
      localStorage.setItem("updated", JSON.stringify(updatedState));
    }
  }

  // Функція додавання FB у локалсторедж
  function saveLoad(fb) {
    if (!FUTURES.markUpdates) {
      return;
    }
    updatedState = initUpdated();

    if (!updatedState.updated.includes(fb)) {
      updatedState.updated.push(fb);
      localStorage.setItem("updated", JSON.stringify(updatedState));
    }
  }
  // додає +1 до loads, підрахунок вантажів
  function increaseLoad() {
    if (!FUTURES.countUpdates) {
      return;
    }
    updatedState = initUpdated();
    updatedState.loads += 1;
    localStorage.setItem("updated", JSON.stringify(updatedState));
  }
  // додає +1 до updates, підрахунок апдейтів

  function increaseUpdate() {
    if (!FUTURES.countUpdates) {
      return;
    }
    updatedState = initUpdated();
    updatedState.updates += 1;
    localStorage.setItem("updated", JSON.stringify(updatedState));
  }
  // рахує кількість заповнених інпутів часу для порівняння і розуміння +loads або +updates
  function countTimes(range) {
    const times = [];
    for (let i = 0; i < range.length; i += 1) {
      if (range[i].value != "") {
        times.push(range[i].value);
      }
    }

    return times;
  }

  //#endregion

  //#region Comments

  //отримуємо коментарі з локала
  function initComments() {
    let comments = localStorage.getItem("comments");

    if (!comments) {
      comments = [];
      localStorage.setItem("comments", JSON.stringify(comments));
    } else {
      comments = JSON.parse(comments);
    }

    return comments;
  }

  // Викликаємо завжди, навіть якщо comments=false
  let commentsState = initComments();

  // зберігає коментар у локал
  function saveComment(data) {
    if (!FUTURES.comments) {
      return;
    }
    commentsState = initComments();

    const index = commentsState.findIndex(
      (c) => Number(c.fb) === Number(data.fb),
    );

    if (index !== -1) {
      commentsState[index] = data;
    } else {
      commentsState.push(data);
    }

    localStorage.setItem("comments", JSON.stringify(commentsState));
  }
  // збирає обʼєкт коментаря який буде збережено
  function generateComment(fb, status, commentBox) {
    if (!FUTURES.comments) {
      return;
    }
    let willBeSaved = {};
    if (commentBox.children.length === 0) {
      willBeSaved = {
        fb: fb,
        comment: "no comments",
        status: status,
      };
    } else {
      willBeSaved = {
        fb: fb,
        status: status,
        comment: findComment(),
        commentTime: findCommentTime(),
        timeZone: findTimeZone(),
        inTime: findInTime(),
      };
    }
    saveComment(willBeSaved);
  }
  // знаходить текст коментаря
  function findComment() {
    let commentsBox = document.querySelector("div.comments__regular");
    let comment;
    if (commentsBox.children.length === 0) {
      return (comment = "no comments yet");
    } else {
      const commentBody = commentsBox.querySelector(".body1");
      comment = commentBody.textContent;
      if (comment.length > 25) {
        comment = `${comment.slice(0, 25)}...`;
      }
      return comment;
    }
  }

  // знаходить час коментаря
  function findCommentTime() {
    const commentTimeBox = document
      .querySelector("div.comment-container")
      .querySelector("span.date");

    const commentTime = `${commentTimeBox.textContent.at(
      -8,
    )}${commentTimeBox.textContent.at(-7)}${commentTimeBox.textContent.at(
      -6,
    )}${commentTimeBox.textContent.at(-5)}${commentTimeBox.textContent.at(
      -4,
    )}${commentTimeBox.textContent.at(-3)}${commentTimeBox.textContent.at(
      -2,
    )}${commentTimeBox.textContent.at(-1)}`;

    return commentTime;
  }

  //знаходить inTime
  function findInTime() {
    let findStops = document.querySelectorAll("div.stop-item");
    let pickUpDateItem = findStops[0].querySelectorAll("p.date");
    let delDateItem =
      findStops[findStops.length - 1].querySelectorAll("p.date");

    if (pickUpDateItem[2].textContent == "") {
      let inTime = `${pickUpDateItem[1].textContent.at(
        -5,
      )}${pickUpDateItem[1].textContent.at(
        -4,
      )}${pickUpDateItem[1].textContent.at(
        -3,
      )}${pickUpDateItem[1].textContent.at(
        -2,
      )}${pickUpDateItem[1].textContent.at(-1)}`;

      return inTime;
    } else {
      let inTime = `${delDateItem[1].textContent.at(
        -5,
      )}${delDateItem[1].textContent.at(-4)}${delDateItem[1].textContent.at(
        -3,
      )}${delDateItem[1].textContent.at(-2)}${delDateItem[1].textContent.at(
        -1,
      )}`;

      return inTime;
    }
  }

  //знаходить часовий пояс
  function findTimeZone() {
    let findStops = document.querySelectorAll("div.stop-item");
    let pickUpDateItem = findStops[0].querySelectorAll("p.date");
    let findTimeZoneBox = document.querySelectorAll("p.m-b-1");

    if (!pickUpDateItem || !findStops || !findTimeZoneBox) {
      return;
    }

    if (pickUpDateItem[2].textContent == "") {
      let timeZone = `${findTimeZoneBox[0].textContent.at(
        -3,
      )}${findTimeZoneBox[0].textContent.at(
        -2,
      )}${findTimeZoneBox[0].textContent.at(-1)}`;
      return timeZone;
    } else {
      let timeZone = `${findTimeZoneBox[1].textContent.at(
        -3,
      )}${findTimeZoneBox[1].textContent.at(
        -2,
      )}${findTimeZoneBox[1].textContent.at(-1)}`;
      return timeZone;
    }
  }

  //малює коменти в таблицю
  function restoreComments() {
    if (!FUTURES.comments) {
      return;
    }
    const commentInterwal = setInterval(() => {
      commentsState = initComments();
      const tbody = getTbody();
      if (!tbody) return;

      const rows = Array.from(tbody.children);

      rows.forEach((row) => {
        const fb = Number(row.children[1].textContent);

        const commentData = commentsState.find((c) => Number(c.fb) === fb);

        if (!commentData) return;

        if (row.children[6]) {
          row.children[6].textContent =
            `${commentData.status || ""} ${commentData.inTime || ""} ${commentData.timeZone || ""}`.trim();
        }

        if (row.children[7]) {
          row.children[7].textContent =
            `${commentData.commentTime || ""} ${commentData.comment || ""}`.trim();
        }
      });
    }, 500);
  }
  restoreComments();
  //видаляє коментрарі
  function cleanupComments() {
    commentsState = initComments();
    const tbody = getTbody();
    if (!tbody) return;

    const rows = Array.from(tbody.children);

    // Збираємо FB вантажів, які мають клас .orange
    const orangeFBs = rows
      .filter((r) => r.classList.contains("orange"))
      .map((r) => Number(r.children[1].textContent));

    // Видаляємо з локала коментарі для вантажів, яких більше немає з .orange
    commentsState = commentsState.filter((c) =>
      orangeFBs.includes(Number(c.fb)),
    );

    localStorage.setItem("comments", JSON.stringify(commentsState));
  }

  function postCommetn() {}

  //#endregion

  // Observer на таблицю (перерендери), чекає завантаження таблиці
  const highlightObserver = new MutationObserver(() => {
    if (getTbody() && getTbody().children.length > 0) {
      restoreUpdatedRows(initUpdated()); //маркує вантажі
      //очищення локала. видаляє фб та коменти
      if (!cleaneDone) {
        removerMissingLoads();
        cleanupComments();
        cleaneDone = true;
      }
    }
  });

  highlightObserver.observe(document.body, { childList: true, subtree: true });

  // Обробка кліку на рядок
  document.body.addEventListener("click", (e) => {
    const row = e.target.closest("tr.ng-star-inserted");
    if (!row) {
      return;
    }

    // Observer на модальне вікно
    const modalObserver = new MutationObserver((mutations, obs) => {
      const stopsWrapper = document.querySelector("div.stops-wrapper");
      const statusEl = document.querySelector("span.mat-mdc-select-min-line");
      const fbEl = document.querySelector(".m-r-1");
      const commentWrapper = document
        .querySelector("div.dispatch-comments")
        .querySelector("div.comments__regular");

      if (!stopsWrapper || !statusEl || !fbEl || !commentWrapper) return;

      const status = statusEl.textContent.trim();
      const fbText = fbEl.textContent.trim();
      const fb = Number(fbText);

      if (!status || !fbText) return; //  чекаємо реальні текстові значення

      //перевірка на статус для збереження коментаря
      if (status === "At Pickup" || status === "At Delivery") {
        generateComment(fb, status, commentWrapper);

        //клік на поле коментаря
        getComentField().addEventListener("click", () => {
          const postBnt = getPostComentBtn();
          //клік на кнопку post
          postBnt.addEventListener("click", () => {
            const date = new Date();

            //зберігажмо коментар який написали
            saveComment({
              fb: fb,
              status: status,
              comment: getComentField().value, //викликаємо з тим що написано
              commentTime: `${date.getHours()}:${date.getMinutes()}`, // отримуємо наявний час
              timeZone: findTimeZone(),
              inTime: findInTime(),
            });
          });
        });
      }

      // обробник на кнопку редагування
      const editBnt = getEditBtn();
      if (editBnt) {
        editBnt.addEventListener(
          "click",
          () => {
            const timesObserver = new MutationObserver((mutations, obs) => {
              const timesWrapper = document.querySelector("div.m-y-5");

              if (!timesWrapper) {
                return;
              }
              const timeInputs = timesWrapper.querySelectorAll(
                "input.mat-mdc-input-element",
              );
              const onFirstOpenTimes = countTimes(timeInputs); // зберігаємо кількість заповнених полів часу

              // обробник кнопки save
              const saveBtn = getSaveBtn();

              saveBtn.addEventListener("click", () => {
                const timesAfterUpdate = countTimes(timeInputs); //зберігаємо кількість заповнених полів часу при натисканні сейв
                if (onFirstOpenTimes.length === timesAfterUpdate.length) {
                  //порівнюємо масиви з часом до і після. отримуємо апдейт або лоад
                  increaseUpdate();
                  return;
                }

                increaseUpdate();
                increaseLoad();
                saveLoad(fb);
                return;
              });

              timesObserver.disconnect();
            });
            timesObserver.observe(document.body, {
              childList: true,
              subtree: true,
            });
          },
          { once: true },
        );
      }

      // після того як дані з модалки доступні — вимикаємо observer
      modalObserver.disconnect();
    });

    modalObserver.observe(document.body, { childList: true, subtree: true });
  });
})();
