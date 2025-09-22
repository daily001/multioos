var $window = $(window);

$window.on("load", function() {
	"use strict";
	
	var wasLastHtmlUpdateAfterUserInput = null,

		// Post messages to the parent window
		messageParent = function(data) {
			parent.postMessage(data, "*");
		},

		// Receive messages sent to this iframe (from the parent window)
		receiveMessage = function(e) {
			var data = e.originalEvent.data;
			
			if (data.hasOwnProperty("html")) updateHtml(data.html, data.isAfterUserInput);
			if (data.hasOwnProperty("scrollLineIntoView")) scrollLineIntoView(data.scrollLineIntoView, data.lineCount);
			if (data.hasOwnProperty("fontSizeCssIncrement")) updateFontSize(data.fontSizeCssIncrement);
			if (data.hasOwnProperty("themeStylesheet")) useTheme(data.themeStylesheet);
		},

		// Send the iframe's height to the parent window
		postHeight = function() {
			messageParent({
				height: $body.height(),
				isAfterUserInput: wasLastHtmlUpdateAfterUserInput
			});
		},

		// Send the iframe's height and text to the parent window
		postAll = function() {
			messageParent({
				height: $body.height(),
				text: $body.text(),
				isAfterUserInput: wasLastHtmlUpdateAfterUserInput
			});
		},

		updateHtml = function(html, isAfterUserInput) {
			$body.html(html);
			wasLastHtmlUpdateAfterUserInput = isAfterUserInput;

			postAll();

			// If there are images, the height of the iframe has to be manually updated to reflect the height of the images
			// Thus, wait for all images to load, then send the actual height to the parent window
			preview.onImagesLoad(postHeight);
		},

		// When scrolling a line into view, the parent window is the one doing the job.
		// The iframe is only sollicited to run the numbers and post back the top and
		// bottom offsets of the element(s) surrounding the given source line, since
		// it requires access to the preview's DOM for that.
		scrollLineIntoView = function(line, lineCount) {
			var offsets = preview.getSourceLineOffset(line, lineCount);
			messageParent({ scrollMarkdownPreviewIntoViewAtOffset: offsets });
		},

		updateFontSize = function(cssIncrement) {
			updateElFontSize($body, cssIncrement);
			postHeight();
		},

		useTheme = function(stylesheet) {
			document.getElementById("theme").setAttribute("href", stylesheet);
		};
	
	$window.on({
		resize: postHeight,
		message: receiveMessage,

		// Post a message to the parent window with interesting properties of all keydown events
		// to dispatch equivalent synthetic events there, since the original ones don't naturally
		// reach that parent window.
		keydown: function(e) {
			messageParent({
				// Only post event props we care about
				keydownEventObj: {
					type: e.type,
					keyCode: e.keyCode,
					ctrlKey: e.ctrlKey,
					metaKey: e.metaKey,
					altKey: e.altKey,
					shiftKey: e.shiftKey
				}
			});

			// All keydown events from this sandboxed frame are posted to and triggered in the parent window.
			// However, the original event isn't posted, so all keydown events that are cancelled by the app
			// to prevent their default action must be cancelled by hand here too. That solution isn't DRY,
			// but it's the best one around.
			// Currently applies to: CTRL (mirrored by META) + W
			if ((e.ctrlKey || e.metaKey) && e.keyCode == 87) e.preventDefault();
		},

		// Post a message to the parent window with interesting properties of all wheel events
		// to dispatch equivalent synthetic events there, since the original ones don't naturally
		// reach that parent window.
		wheel: function(e) {
			messageParent({
				// Only post event props we care about
				wheelEventObj: {
					type: e.type,
					ctrlKey: e.ctrlKey,
					metaKey: e.metaKey,
					deltaY: e.originalEvent.deltaY,
					isSynthetic: true
				}
			});
		}
	});
	
	$body.on("click", function(e) {
		if (e.target.nodeName != "A") return; // Not using jQuery for event delegation since it lead to an issue where middle mouse clicks didn't trigger "click" events

		e.preventDefault();

		var href = $(e.target).attr("href"),
			isAnchor = href.slice(0, 1) == "#";

		// If the link is an anchor, manually scroll to the anchor target's position
		if (isAnchor) {
			let target = href.slice(1),
				targetOffset = null;

			if (target == "" || target == "top") {
				targetOffset = 0;
			} else {
				let targetEl = document.getElementById(target);
				if (targetEl) targetOffset = getElRefOffset(targetEl);
			}

			if (targetOffset != null) messageParent({ scrollMarkdownPreviewToOffset: targetOffset });
		// Otherwise open the link in an external window
		} else {
			// If the URL is missing a scheme, add one
			let validURIScheme = /^[a-z][a-z\d+.-]+:\/\//i;
			if (!validURIScheme.test(href)) href = "http://"+ href;

			open(href, "MME_external_link");
		}
		
	});
	
});