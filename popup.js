let attachDbg = document.getElementById("attachDbg");
let screenshotBtn = document.getElementById("screenshot");
let screenshotBatchBtn = document.getElementById("screenshotBatch");
let clearBatchBtn = document.getElementById("clearBatch");
let dlBatchBtn = document.getElementById("dlBatch");
let setEmulation = document.getElementById("setEmulation");
let clearEmulation = document.getElementById("clearEmulation");

let widthArg = document.getElementById("widthArg");
let heightArg = document.getElementById("heightArg");

let countLabel = document.getElementById("count");

chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
	let tab = tabs[0];
	if(tab.url.indexOf('chrome://') != 0)
	{
		chrome.scripting.executeScript({ target: {tabId: tab.id}, files: ['content.js'] }, result => {
			chrome.tabs.sendMessage(tab.id, {type: 'query', query: 'dimension'}, (res) => {
				if (chrome.runtime.lastError) {
					console.log('runtime.lastError', tab.id, chrome.runtime.lastError.message);
					return;
				}
				widthArg.value = res.width;
				heightArg.value = res.height;
			});
		});
		chrome.runtime.sendMessage({type: 'query', query: 'has_debugger', tabId: tab.id}, (res) => {
			if (chrome.runtime.lastError) {
				console.log('runtime.lastError', tab.id, chrome.runtime.lastError.message);
				return;
			}
			updateHasDebugger(res);
		});
	}
	else
	{
		attachDbg.disabled = true;
		screenshotBtn.disabled = true;
		setEmulation.disabled = true;
		clearEmulation.disabled = true;
		screenshotBatchBtn.disabled = true;
	}
	//Get file count
	chrome.runtime.sendMessage({type: 'query', query: 'count'}, async (res) => {
		if (chrome.runtime.lastError) {
			console.log('runtime.lastError', tab.id, chrome.runtime.lastError.message);
			return;
		}
		setFileCount(res);
	});
});

function getFileCount()
{
	return parseInt(countLabel.innerHTML.substring(7));
}
function setFileCount(count)
{
	countLabel.innerHTML = "Files: " + count;
}
function updateHasDebugger(hasDebugger)
{
	attachDbg.disabled = hasDebugger;
	screenshotBtn.disabled = !hasDebugger;
	setEmulation.disabled = !hasDebugger;
	clearEmulation.disabled = !hasDebugger;
	screenshotBatchBtn.disabled = !hasDebugger;
}

attachDbg.addEventListener("click", async () => {
	let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	chrome.runtime.sendMessage({type: 'command', command: 'attach_debugger', tabId: tab.id}, (res) => {
		updateHasDebugger(true);
	});
});

chrome.debugger.onDetach.addListener((source, reason) => {
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		if(tabs[0].id === source.tabId)
		updateHasDebugger(false);
	});
});

setEmulation.addEventListener("click", async () => {
	let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	console.log("Starting Emulation", tab.id);
	
	let w = parseInt(widthArg.value)
	let h = parseInt(heightArg.value)
    chrome.debugger.sendCommand(
		{tabId: tab.id},
		"Emulation.setDeviceMetricsOverride",
		{
			width: w,
			height: h,
			deviceScaleFactor: 0,
			mobile: false
		},
		(response) => {
			console.log(response);
		}
	);
});

clearEmulation.addEventListener("click", async () => {
	let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	console.log("Stopping Emulation", tab.id);
	
	chrome.debugger.sendCommand(
		{tabId: tab.id},
		"Emulation.clearDeviceMetricsOverride",
		{},
		(response) => {
			console.log(response);
		}
	);
});

function toName(date)
{
	return `${date.getFullYear()}_${`0${date.getMonth()+1}`.slice(-2)}_${`0${date.getDate()}`.slice(-2)}_${`0${date.getHours()}`.slice(-2)}_${`0${date.getMinutes()}`.slice(-2)}_${`0${date.getSeconds()}`.slice(-2)}`;
}
screenshotBtn.addEventListener("click", async () => {
	let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	chrome.runtime.sendMessage({type: 'command', command: 'screenshot_single', tabId: tab.id});
});

screenshotBatchBtn.addEventListener("click", async () => {
	let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	chrome.runtime.sendMessage({type: 'command', command: 'screenshot_batch', tabId: tab.id}, (res) => {
		setFileCount(getFileCount()+1);
	});
});

clearBatchBtn.addEventListener("click", async () => {
	chrome.runtime.sendMessage({type: 'command', command: 'clear_zip'});
	setFileCount(0);
});

dlBatchBtn.addEventListener("click", async () => {
	chrome.runtime.sendMessage({type: 'command', command: 'download_zip', name: toName(new Date())});
});