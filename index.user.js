// ==UserScript==
// @name         Simple Copymanga Downloader
// @namespace    -
// @version      0.1.0
// @description  沒什麼技術成分，非常暴力的下載器
// @author       LianSheng
// @match        https://www.copymanga.com/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.5.0/jszip.min.js
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==



const CORSProxy = "https://simple-cors-anywhere.herokuapp.com/";
const Url = location.href;

// 工具：同步 forEach
async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

// 主頁：控制是否爲選取模式，若是則不觸發連結
function clickProxy(event, selectMode) {
    if(selectMode){
        event.preventDefault();
        event.stopPropagation();

        let a = event.target;
        a.classList.toggle("selected");
    }
}

// 主頁：下載所有已選，若 retry 爲 true 則只下載失敗的
function downloadSelected(retry=false) {
    let allLi, allData;

    if(retry){
        allLi = document.querySelectorAll("div[id].active ul.table-all a li.selected.failed");
        allData = [...allLi].map( li => [li.parentElement.getAttribute("title"), li.parentElement.getAttribute("href"), li]);
    } else {
        allLi = document.querySelectorAll("div[id].active ul.table-all a li.selected");
        allData = [...allLi].map( li => [li.parentElement.getAttribute("title"), li.parentElement.getAttribute("href"), li]);
    }

    asyncForEach(allData, async data => {
        GM_setValue("downloading", data[0]);
        let wid = window.open(`https://www.copymanga.com${data[1]}`);

        await new Promise((resolve, reject) => {
            let count = 0;
            let id = setInterval(() => {
                if(GM_getValue("downloading") == "completed"){
                    clearInterval(id);
                    resolve();
                }

                // 超時：600*100ms = 60s
                if(count > 600) {
                    clearInterval(id);
                    reject();
                }

                count++;
            }, 100);
        }).then(() => {
            // 下載成功
            GM_setValue("downloading", undefined);
            data[2].classList.remove("selected");
            data[2].classList.add("success");
        }).catch(() => {
            // 超時，判斷爲下載失敗，略過
            GM_setValue("downloading", undefined);
            data[2].classList.remove("selected");
            data[2].classList.add("failed");
        });

        wid.close();
    });
}

// 單頁：下載
async function downloanThisEpisode(imgs) {
    const zip = new JSZip();
    const data = document.querySelector("h4").innerText.split("/");
    const title = data[0];
    const name = data[1].replace(".", "-");

    await asyncForEach(imgs, async (img, index) => {
        let realSrc = img.getAttribute("data-src");
        await fetch(`${CORSProxy}${realSrc}`).then(
            r => r.blob()
        ).then( image => {
            zip.file(`${index+1}.webp`, image);
        });
    });

    await zip.generateAsync({type:"base64"}).then(
        base64 => window.location = "data:application/zip;base64," + base64
    ).then(zip => {
        let link = document.createElement('a');
        link.setAttribute('href', zip);
        link.setAttribute('download', `${title}_${name}`);
        link.click();
        GM_setValue("downloading", "completed");
    }).catch(() => {
        GM_setValue("downloading", undefined);
    });

    window.close();
}

(function() {
    'use strict';

    GM_addStyle(`.selected { background-color: lightblue; } .success { background-color: lightgreen; } .failed { background-color: pink; }`);

    if(Url.match(/\/comic\/[^\/]+$/)){
        // 特定漫畫選擇話次頁

        const Title = document.querySelector("h6").innerText;
        let selectMode = false;

        let id = setInterval(() => {
            let episodeList = document.querySelectorAll("ul.table-all");
            let buttonAdded = false;

            if(episodeList.length == 0)
                return;
            else
                clearInterval(id);

            episodeList.forEach( list => {
                // 個別清單

                if(! buttonAdded) {
                    let field = document.querySelector(".table-default-right");
                    field.insertAdjacentHTML("afterbegin", `<span style="user-select: none; cursor: pointer; padding-top: 6px; padding-right: 2rem;"><input type="checkbox" id="cb_changeMode"><label for="cb_changeMode">&nbsp;單選模式</label><span style="width: 2rem; display: inline-block;"></span><input type="checkbox" id="cb_selectAll"><label for="cb_selectAll">&nbsp;全選</label><span style="width: 2rem; display: inline-block;"></span><button id="btn_download">下載選取</button><span style="width: 2rem; display: inline-block;"></span><button id="btn_retry">重試失敗的下載</button></span>`);
                    field.querySelector("#btn_download").onclick = () => {
                        let ok = confirm("請確認 pop-up 的權限已開啓，否則無法正常運作。\n（這個訊息每次都會顯示，無論是否已開啓）");
                        if(ok){
                            downloadSelected();
                        }
                    };
                    field.querySelector("#btn_retry").onclick = () => {
                        let ok = confirm("請確認 pop-up 的權限已開啓，否則無法正常運作。\n（這個訊息每次都會顯示，無論是否已開啓）");
                        if(ok){
                            downloadSelected(true);
                        }
                    };
                    field.querySelector("#cb_changeMode").onchange = () => selectMode = !selectMode;
                    field.querySelector("#cb_selectAll").onchange = e => {
                        let checked = e.target.checked;
                        let episodes = document.querySelectorAll("div[id].active ul.table-all a li");

                        if(checked){
                            episodes.forEach( ep => {
                                ep.classList.add("selected");
                            });
                        } else {
                            episodes.forEach( ep => {
                                ep.classList.remove("selected");
                            });
                        }
                    };

                    buttonAdded = true;
                }

                list.childNodes.forEach( ep => {
                    // 個別話次
                    ep.onclick = e => {
                        clickProxy(e, selectMode);
                    };
                });
            });
        }, 100);
    } else if(Url.match(/\/comic\/[^\/]+\/chapter\/.+$/)){
        let id = setInterval(() => {
            let allImg = document.querySelectorAll(".comicContent-image-all img");

            if(allImg.length > 0){
                clearInterval(id);
                downloanThisEpisode([...allImg]);
            }
        }, 100);
    }
})();
