try {
	importScripts('jszip.min.js');
} catch (e) {
	console.error(e);
}

const isEmpty = (obj) => {
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}

async function getDataZip()
{
	return chrome.storage.local.get('zip').then(data => {
		if(isEmpty(data))
			return new JSZip().generateAsync({type: 'base64'}).then(zip => {return zip});
		return data.zip;
	});
}
async function getZip()
{
	return chrome.storage.local.get('zip').then(data => {
		if(isEmpty(data))
			return new JSZip();
		return JSZip.loadAsync(data.zip, {base64: true}).then(zip => {
			return zip;
		});
	});
}
async function getCount()
{
	return chrome.storage.local.get('count').then(data => {
		if(isEmpty(data))
			return 0;
		return data.count;
	});
}



function toName(date)
{
	return `${date.getFullYear()}_${`0${date.getMonth()+1}`.slice(-2)}_${`0${date.getDate()}`.slice(-2)}_${`0${date.getHours()}`.slice(-2)}_${`0${date.getMinutes()}`.slice(-2)}_${`0${date.getSeconds()}`.slice(-2)}`;
}

function attachDebugger(tabId, onDone = undefined)
{
	console.log("Attaching debugger", tabId);
    chrome.debugger.attach({ tabId: tabId }, '1.3', () => {
        if (chrome.runtime.lastError) {
            console.log('runtime.lastError', tabId, chrome.runtime.lastError.message);
            return;
        }
        console.log("Debugger attached", tabId);
		chrome.action.setIcon(onIcons);
		if(onDone != undefined)
			onDone(0);
	});
}

/*
function injectOverlay()
{
	function htmlToElement(html) {
		var template = document.createElement('template');
		html = html.trim();
		template.innerHTML = html;
		return template.content.firstChild;
	}
	let overlay = htmlToElement("<div style=\"top:0; left:0; height:100%; width:100%; z-index: 2147483647; position:fixed; background-color:#00000088\"></div>");
	document.body.append(overlay);
}
*/

function screenshotSingle(tabId, onDone = undefined)
{
	//chrome.scripting.executeScript({target: { tabId: tabId }, function: injectOverlay});
	chrome.debugger.sendCommand(
		{tabId: tabId},
		"Page.captureScreenshot",
		(response) => {
			url = 'data:image/png;base64,'+response.data;
			chrome.downloads.download({url: url, filename: toName(new Date()) + '.png', conflictAction: 'uniquify'});
			if(onDone != undefined)
				onDone(0);
		}
	);
}

function screenshotBatch(tabId, onDone = undefined)
{
	chrome.debugger.sendCommand(
		{tabId: tabId},
		"Page.captureScreenshot",
		(response) => {
			zipImage(toName(new Date()), response.data, onDone);
		}
	);
}

function zipImage(name, data, onDone = undefined)
{
	getZip().then(zip => {
		let dupes = zip.file(new RegExp(name)).length;
		if(dupes === 0)
			zip.file(name + ".png", data, {base64: true});
		else
			zip.file(name + " (" + dupes + ").png", data, {base64: true});
		Promise.all([zip.generateAsync({type: 'base64'}), getCount()])
		.then(result => {
			chrome.storage.local.set({zip: result[0], count: result[1] + 1});
			if(onDone != undefined)
				onDone(0);
		});
	});
}

function hasDebugger(tabId)
{
	return chrome.debugger.getTargets().then(arr => {
		arr = arr.filter(target => target.tabId === tabId);
		return arr.length == 1 && arr[0].attached;
	});
}

chrome.commands.onCommand.addListener((command) => {
	console.log(`Command: ${command}`);
	chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
		let tab = tabs[0];
		switch(command)
		{
			case 'attach_debugger':
				attachDebugger(tab.id);
				break;
			case 'screenshot_single':
				screenshotSingle(tab.id);
				break;
			case 'screenshot_batch':
				screenshotBatch(tab.id);
				break;
		}
	});
});

var onIcons = {path: { 16: "/images/icon_on_16.png", 32: "/images/icon_on_32.png", 48: "/images/icon_on_48.png", 128: "/images/icon_on_128.png" }};
var offIcons = {path: { 16: "/images/icon_off_16.png", 32: "/images/icon_off_32.png", 48: "/images/icon_off_48.png", 128: "/images/icon_off_128.png" }};

chrome.tabs.onActivated.addListener(activeInfo => {
	hasDebugger(activeInfo.tabId).then(res => {
		chrome.action.setIcon(res ? onIcons : offIcons);
	});
});
chrome.debugger.onDetach.addListener((source, reason) => {
	chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
		if(tabs[0].id === source.tabId)
			chrome.action.setIcon(offIcons);
	});
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	if(sender.id === chrome.runtime.id)
	{
		console.log(msg);
		switch(msg.type)
		{
			case 'command':
				var zip = undefined;
				var data = undefined;
				switch(msg.command)
				{
					case 'clear_zip':
						chrome.storage.local.remove(['zip', 'count']);
						break;
					case 'download_zip':
						getDataZip().then(zip_content => {
							let url = 'data:application/octet-stream;base64,' + zip_content;
							chrome.downloads.download({url: url, filename: msg.name + ".zip", conflictAction: 'uniquify'})
						});
						break;
					case 'screenshot_single':
						screenshotSingle(msg.tabId, sendResponse);
						break;
					case 'screenshot_batch':
						screenshotBatch(msg.tabId, sendResponse);
						break;
					case 'attach_debugger':
						attachDebugger(msg.tabId, sendResponse);
						break;
				}
				break;
			case 'query':
				switch(msg.query)
				{
					case 'count':
						getCount().then(count => {
							sendResponse(count)
						});
						break;
					case 'has_debugger':
						hasDebugger(msg.tabId).then(res => {
							sendResponse(res);
						});
						break;
				}
				break;
		}
	}
	return true;
});