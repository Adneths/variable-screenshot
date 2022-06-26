try {
	importScripts('./libs/jszip.min.js');
	importScripts('./libs/utils.js');
} catch (e) {
	console.error(e);
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

function screenshotSingle(tabId, onDone = undefined)
{
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
			getUnprocessedCount().then(unprocessedCount => {
				obj = {unprocessedCount: unprocessedCount+1};
				obj['image'+unprocessedCount] = {name: toName(new Date()), data: response.data};
				chrome.storage.local.set(obj);
				getCount().then(count => {
					chrome.storage.local.set({count: count + 1});
					if(onDone != undefined)
						onDone(0);
				});
			});
		}
	);
}

function removeBatch()
{
	chrome.storage.local.remove(['zip', 'count']);
	getUnprocessedCount().then(unprocessedCount => {
		for(let i = 0; i < unprocessedCount; i++)
			chrome.storage.local.remove('image'+i);
		chrome.storage.local.set({unprocessedCount: 0});
	});
	getZipCount().then(zipCount => {
		for(let i = 0; i < zipCount; i++)
			chrome.storage.local.remove('zip'+i);
		chrome.storage.local.set({zips: 0});
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
				switch(msg.command)
				{
					case 'clear_zip':
						removeBatch();
						sendResponse(0);
						break;
					case 'download_zip':
						chrome.storage.local.get('zipping').then(data => {
							if(!data.zipping)
								chrome.tabs.create({url: './download/download.html'});
						});
						sendResponse(0);
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