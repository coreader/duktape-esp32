/**
 * This is the IDE for ESP32-Duktape
 */
$(document).ready(function() {
	
	var consoleConnected = true; // Is the console web socket connected?
	var settings;
	
	if (localStorage.settings) {
		settings = JSON.parse(localStorage.settings);
	} else {
		var settings = {
			esp32_host: "192.168.1.99",
			esp32_port: 80,
			theme: "eclipse"
		}	
	}
	
	/**
	 * Run a script on the ESP32 Duktape environment by sending in a POST request
	 * with the body of the message being the script to execute.
	 * 
	 * @param script A string representation of the script to run.
	 * @returns N/A
	 */
	function runScript(script) {
		$.ajax({
			url: "http://" + settings.esp32_host + ":" + settings.esp32_port + "/run",
			contentType: "application/javascript",
			method: "POST",
			data: script,
			success: function() {
				console.log("Code sent for execution.");
			}
		}); // .ajax
	} // runScript
	
	
	/**
	 * Connect to the ESP32 for the console websocket.
	 * @param onOpen A callback function to be invoked when the socket has been established.
	 * @returns N/A
	 */
	function createConsoleWebSocket(onOpen) {
		return;
		var ws = new WebSocket("ws://" + settings.esp32_host + ":" + settings.esp32_port + "/console");
		// When a console message arrives, append it to the console log and scroll so that it is visible.
		ws.onmessage = function(event) {
			$("#console").val($("#console").val() + event.data);
			$('#console').scrollTop($('#console')[0].scrollHeight);
		}
		ws.onclose = function() {
			$("#newWebSocket").button("enable");
			$("#console").prop("disabled", true);
			consoleConnected = false;
		}
		ws.onopen = function() {
			consoleConnected = true;
			$("#console").prop("disabled", false);
			if (onOpen != null) {
				onOpen();
			}
		}		
	} // createConsoleWebSocket
	
	/**
	 * We have the need to populate a <select> with the names of files stored on the ESP32.
	 * This function performs that task by making a REST request to the ESP32 to retrieve
	 * them.  The results are then inserted into the <select>
	 * @param selectObj The jQuery object representing the <select>
	 * @param callback A callback to invoke when done.
	 * @returns N/A
	 */
	function populateSelectWithFiles(selectObj, callback) {
		$.ajax({
			url: "http://" + settings.esp32_host + ":" + settings.esp32_port + "/files",
			method: "GET",
			dataType: "json",
			success: function(data) {
				data.sort(function(a, b) {
					if (a.name < b.name) {
						return -1;
					}
					if (a.name > b.name) {
						return 1;
					}
					return 0;
				});
				$(selectObj).empty();
				for (var i=0; i<data.length; i++) {
					$(selectObj).append($("<option>", {value: data[i].name, text: data[i].name}));
				}
				if (callback) {
					callback();
				}
			} // Success
		}); // .ajax
	} // populateSelectWithFiles

	
	// Create the page layout.
	$("#c1").layout({
		applyDefaultStyles: true,
		// The center pane is the editor.
		center: {
			onresize: function() {
				editor.resize();
			}
		},
		// The south pane is the console.
		south: {
			size: 200, // Set its initial height.
			closable: true // Flag the console pane as closable.
		}
	});

	// Create the ace editor
	var editor = ace.edit("editor");
	editor.setTheme("ace/theme/" + settings.theme);
	editor.getSession().setMode("ace/mode/javascript"); // Set the language to be JavaScript
	editor.setFontSize(16);
	editor.setOption("showPrintMargin", false);
	editor.$blockScrolling = Infinity;
	
	// Handle the run button
	$("#run").button({
		icon: "ui-icon-play" // Set the icon on the button to be the play icon.
	}).click(function() {
		if (consoleConnected) {
			runScript(editor.getValue());
		} else {
			createConsoleWebSocket(function() {
				runScript(editor.getValue());
			});
		}
	});
	
	// Handle the clear console button.
	$("#clearConsole").button({
		icon: "ui-icon-trash" // Set the icon on the button to be the trash can.
	}).click(function() {
		$("#console").val("");
	});
	
	$("#load").button().click(function() {
		$.ajax({
			url: "http://" + settings.esp32_host + ":" + settings.esp32_port + "/files",
			method: "GET",
			dataType: "json",
			success: function(data) {
				populateSelectWithFiles($("#loadSelect"), function() {
					$("#loadDialog").dialog("open");
				});
			} // Success
		}); // .ajax
	});
	
	
	/**
	 * Handle the save button being pressed on the main window.
	 * This will open the save dialog.
	 */
	$("#save").button().click(function() {
		$("#saveDialog").dialog("open");
	});
	
	// Handle the settings button.
	$("#settings").button({
		icon: "ui-icon-wrench" // Set the icon on the button to be the wrench.
	}).click(function() {
		$("#settingsHost").val(settings.esp32_host);
		$("#settingsPort").val(settings.esp32_port);
		$("#fontSize").val(editor.getFontSize());
		$("#theme").val(settings.theme);
		$("#settingsDialog").dialog("open");
	});
	
	$("#info").click(function(){
		console.log("Info!");
		open("https://github.com/nkolban/duktape-esp32");
	});
	
	$("#repl").on("keypress", function(e) {
		if (e.keyCode == 13) {
			runScript($("#repl").val());
			return false;
		}
	});
	
	
	// Create and handle the save file dialog
	$("#saveDialog").dialog({
		autoOpen: false,
		modal: true,
		width: 400,
		buttons: [
			{
				text: "Save",
				click: function() {
					var selectedFile = $("#saveFileNameText").val().trim(); // Get the input file name.
					if (selectedFile.length == 0) { // Check that it is not empty
						return; // No file name entered.
					}

					if (selectedFile.charAt(0) != '/') { // File must start with a "/".  Add it if not present.
						selectedFile = "/" + selectedFile;
					}
					
					// Make a REST call to the ESP32 to save the data.  The URL is:
					// POST /files/<fileName>
					// Body: Data to save
					$.ajax({
						url: "http://" + settings.esp32_host + ":" + settings.esp32_port + "/files" + selectedFile,
						method: "POST",
						data: editor.getValue(),
						success: function(data) {
							$(this).dialog("close");
						}
					}); // .ajax
				}
			},
			{
				text: "Cancel",
				click: function() {
					$(this).dialog("close");
				}
			}
		]
	}); // #saveDialog
			
			
	// Create and handle the load file dialog
	$("#loadDialog").dialog({
		autoOpen: false,
		modal: true,
		width: 400,
		buttons: [
			{
				text: "Load",
				click: function() {
					// Determine which file was selected in the list
					var selectedFile = $("#loadSelect option:selected").val();
					// Retrieve the content of a file from ESP32 file store.
					// the REST request format is:
					// GET /files/<fileName>
					$.ajax({
						url: "http://" + settings.esp32_host + ":" + settings.esp32_port + "/files" + selectedFile,
						method: "GET",
						dataType: "text",
						success: function(data) {
							editor.setValue(data);
						}
					});
					$(this).dialog("close");
				} // Click on the load button
			},
			{
				text: "Cancel",
				click: function() {
					$(this).dialog("close");
				}
			}
		]
	});
	
	// Create and handle the settings dialog.
	$("#settingsDialog").dialog({
		autoOpen: false, // Do not auto open the dialog
		modal: true, // Dialog should be model.
		width: 400, // Width of dialog.
		buttons: [
			// The OK button is clicked to confirm the entries.
			{
				text: "OK",
				click: function() {
					settings.esp32_host = $("#settingsHost").val();
					settings.esp32_port = $("#settingsPort").val();
					settings.theme = $("#theme option:selected").val();
					localStorage = JSON.stringify(settings);
					
					editor.setFontSize($("#fontSize").val());
					editor.setTheme("ace/theme/" + settings.theme);
					$(this).dialog("close");
				}
			},
			// The Cancel button is clicked to cancel any settings changes.
			{
				text: "Cancel",
				click: function() {
					$(this).dialog("close");
				}
			}
		] // Array of buttons
	}); // Settings dialog
}); // onReady.