chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
	if(sender.id === chrome.runtime.id)
	{
		console.log(msg);
		switch(msg.type)
		{
			case 'query':
				res = {};
				switch(msg.query)
				{
					case 'dimension':
						res.width = window.innerWidth;
						res.height = window.innerHeight;
						break;
					default:
						break;
				}
				sendResponse(res);
				break;
		}
	}
});