define(function (require, exports, modul) {
    "use strict";
    var EditorManager   = brackets.getModule("editor/EditorManager"),
        ExtensionUtils  = brackets.getModule("utils/ExtensionUtils"),
		Resizer			= brackets.getModule('utils/Resizer'),
		DocumentManager = brackets.getModule('document/DocumentManager'),
		CodeMirror		= brackets.getModule("thirdparty/CodeMirror2/lib/codemirror"),
		dragState 		= false,
		CurrentDocument,
		$content,
		$root,
		$minimapOverlay,
		$minimapRoot;
	// CodeMirror, copyright (c) by Marijn Haverbeke and others
	// Distributed under an MIT license: http://codemirror.net/LICENSE
	CodeMirror.runMode = function(string, modespec, callback, options) {
		var mode = CodeMirror.getMode(CodeMirror.defaults, modespec);
		var ie = /MSIE \d/.test(navigator.userAgent);
		var ie_lt9 = ie && (document.documentMode == null || document.documentMode < 9);

		if (callback.nodeType == 1) {
			var tabSize = (options && options.tabSize) || CodeMirror.defaults.tabSize;
			var node = callback, col = 0;
			node.innerHTML = "";
			callback = function(text, style) {
				if (text == "\n") {
					// Emitting LF or CRLF on IE8 or earlier results in an incorrect display.
					// Emitting a carriage return makes everything ok.
					node.appendChild(document.createTextNode(ie_lt9 ? '\r' : text));
					col = 0;
					return;
				}
				var content = "";
				// replace tabs
				for (var pos = 0;;) {
					var idx = text.indexOf("\t", pos);
					if (idx == -1) {
						content += text.slice(pos);
						col += text.length - pos;
						break;
					} else {
						col += idx - pos;
						content += text.slice(pos, idx);
						var size = tabSize - col % tabSize;
						col += size;
						for (var i = 0; i < size; ++i) content += " ";
						pos = idx + 1;
					}
				}
				if (style) {
					var sp = node.appendChild(document.createElement("span"));
					sp.className = "cm-" + style.replace(/ +/g, " cm-");
					sp.appendChild(document.createTextNode(content));
				} else {
					node.appendChild(document.createTextNode(content));
				}
			};
	  	}
		var lines = CodeMirror.splitLines(string), state = CodeMirror.startState(mode);
		for (var i = 0, e = lines.length; i < e; ++i) {
			if (i) callback("\n");
			var stream = new CodeMirror.StringStream(lines[i].substr(0,100));
			while (!stream.eol()) {
				var style = mode.token(stream, state);
				callback(stream.current(), style, i, stream.start, state);
				stream.start = stream.pos;
			}
		}
	};
	function jumpTo(y, setCursor) {
		//y == mouse.y relative 2 minimap
//		var t = $minimapRoot.css('top');
//		var top = Math.abs(parseInt(t.replace('px', '')));
		var clickedLine = Math.round(y / 20 * 4);
		if (setCursor) {
			setEditorLine(clickedLine);
		} else {
			console.log(clickedLine, y);
			setEditorView(clickedLine);
		}
	}
	function setEditorView(firstLine) {
		var currentEditor = EditorManager.getActiveEditor(), //egal welcher editor für getTextHeight
			scrollPosition = firstLine * currentEditor.getTextHeight();
		currentEditor.setScrollPos(0, scrollPosition);
		currentEditor.focus();
		updateScrollOverlay();
	}
	//pixel based
	function updateScrollOverlay() {
		var currentEditor = CurrentDocument._masterEditor,
			editorHeight = $(currentEditor.getScrollerElement()).height(),
			firstLine = Math.round(currentEditor.getScrollPos().y / currentEditor.getTextHeight()),
			lineHight = 20,
			contentHeight = $content[0].parentNode.clientHeight - 54,
			scrollPercent = currentEditor.getScrollPos().y / (currentEditor.totalHeight() - 30 - editorHeight);


		var overlayHeight = Math.round(editorHeight / currentEditor.getTextHeight() * lineHight);
		$minimapOverlay.css('height', overlayHeight + 'px');

		if (($minimapRoot.height() / 4) > contentHeight) {
			var overageLines = $minimapRoot.height() / 4 - contentHeight;
			console.log(overageLines, overageLines *4)
			// -2326
			overageLines = overageLines *4;
			$minimapRoot.css('top', 0 - scrollPercent * overageLines + 'px');
			var t = scrollPercent * (contentHeight - $minimapOverlay.height() / 4) * 4;// - overlayHeight;//(overlayHeight / 4)) * 4;
		} else {
			$minimapRoot.css('top', 0 + 'px');
			var t = scrollPercent * ($minimapRoot.height() / 4 - $minimapOverlay.height() / 4) * 4;// - overlayHeight;//(overlayHeight / 4)) * 4;
		}
		$minimapOverlay.css('top', t + 'px');
	}


	exports.init = function ($parent) {
		$root = $parent;
		$minimapOverlay = $('<div class="minimap-overlay"></div>');
		$minimapRoot = $('<div class="minimap-root cm-s-dark-theme"></div>');
		$content = $($parent.parent('.content')[0]);



		$parent.on('mousedown', function(e) {
			console.log(e)
			if (e.target === $minimapOverlay[0]) {
				dragState = 'possible';
			} else if (e.target === $minimapRoot[0] || e.target.offsetParent === $minimapRoot[0]) {
				//console.log(e.offsetY);
				//scrollTo(e.offsetY);
				jumpTo(e.offsetY , true);
			}
		});
		$parent.on('mousemove', function(e) {
			if (dragState == 'possible') {
				//start dragging
				dragState = 'dragging';
			}
			if (dragState == 'dragging') {
				console.log(e);
				var minimapRootTop = parseInt($minimapRoot.css('top')),
					minimapOverlayTop = parseInt($minimapOverlay.css('top'));
				jumpTo(minimapRootTop + minimapOverlayTop + e.offsetY, false);
			}
		});
		//mouseup on document
		$(document).on('mouseup', function(e) {
			if (dragState === 'dragging' || dragState === 'possible') {
				dragState = false;
			}
		});

//		$parent.on('mousewheel', function(e) {
//			scrollTo(e.originalEvent.wheelDeltaY * -1, true);
//			return false;
//		});
		$parent.append($minimapOverlay);
		$parent.append($minimapRoot);
	};
	exports.update = function (doc) {
		var mode = doc.getLanguage().getMode(),
			text = doc.getText();
		CurrentDocument = doc;
		$minimapRoot.html('');
		CodeMirror.runMode(text, mode, $minimapRoot[0]);

		var currentEditor = doc._masterEditor;
		$(currentEditor).on('scroll', function(e) {
			if (dragState === false) {
				updateScrollOverlay();
			}
		});
		updateScrollOverlay();
	};
});
