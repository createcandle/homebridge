(function() {
	class Homebridge extends window.Extension {
	    constructor() {
	      	super('homebridge');
      		
            this.debug = false; // if enabled, show more output in the console
            this.response_error_count = 0;
            
            // We'll try and get this data from the addon backend
            this.a_number_setting = null;
            this.plugins = [];
            this.plugins_blacklist = [
              'homebridge-config-ui',
              'homebridge-config-ui-rdp',
              'homebridge-rocket-smart-home-ui',
              'homebridge-ui',
              'homebridge-to-hoobs',
              'homebridge-server',
            ];
            
            
			//console.log("Adding homebridge addon to main menu");
			this.addMenuEntry('Homebridge');
            
            // Load the html
            this.content = ''; // The html from the view will be loaded into this variable
			fetch(`/extensions/${this.id}/views/content.html`)
	        .then((res) => res.text())
	        .then((text) => {
	         	this.content = text;
                
                // This is needed because the user might already be on the addon page and click on the menu item again. This helps to reload it.
	  		 	if( document.location.href.endsWith("extensions/homebridge") ){
	  		  		this.show();
	  		  	}
	        })
	        .catch((e) => console.error('Failed to fetch content:', e));
            
            
            // This is not needed, but might be interesting to see. It will show you the API that the controller has available. For example, you can get a list of all the things this way.
            //console.log("window API: ", window.API);
            
	    }






		//
        //  SHOW
        //
        // This is called then the user clicks on the addon in the main menu, or when the page loads and is already on this addon's location.
	    show() {
			if(this.debug){
                console.log("homebridge show called");
            }
			//console.log("this.content:");
			//console.log(this.content);
            
            
			const main_view = document.getElementById('extension-homebridge-view');
			
			if(this.content == ''){
                console.log("content has not loaded yet");
				return;
			}
			else{
				main_view.innerHTML = this.content;
			}
			
            
            // ADD button press
            document.getElementById('extension-homebridge-add-item-button').addEventListener('click', (event) => {
            	if(this.debug){
                    console.log("first button clicked. Event: ", event);
                }
                
                const new_name = document.getElementById('extension-homebridge-add-item-name').value;
                const new_value = document.getElementById('extension-homebridge-add-item-value').value;
                
                if(new_name == ""){
                    alert("Please provide a name");
                    return;
                }
                    
                // isNaN is short for "is not a number"
                if(isNaN(new_value)){
                    alert("Please provide a valid number");
                    return;
                }
                
                // If we end up here, then a name and number were present in the input fields. We can now ask the backend to save the new item.
				window.API.postJson(
					`/extensions/${this.id}/api/ajax`,
					{'action':'add', 'name':new_name  ,'value':new_value}
                    
				).then((body) => {
                    if(this.debug){
                        console.log("add item response: ", body);
                    }
                    if(body.state == true){
                        document.getElementById('extension-homebridge-add-item-name').value = "";
                        document.getElementById('extension-homebridge-add-item-value').value = null;
                    }
                    else{
                        if(this.debug){
                            console.log("saving new item failed!");
                        }
                        alert("sorry, saving new item failed.");
                    }
                    
				}).catch((e) => {
					console.log("homebridge: connnection error after add new item button press: ", e);
                    alert("failed to add new item: connection error");
				});
            
            });
            
            
            // Easter egg when clicking on the title
			document.getElementById('extension-homebridge-title').addEventListener('click', (event) => {
                this.show();
			});
            
            
            // PAIRING BUTTON
            document.getElementById('extension-homebridge-show-pairing-button').addEventListener('click', (event) => {
                if(this.debug){
                    console.log("clicked on pairing button");
                }
                document.getElementById('extension-homebridge-pairing').style.display = 'block';
                
		  		// Get_pin
		        window.API.postJson(
		          `/extensions/${this.id}/api/ajax`,
                    {'action':'pair'}

		        ).then((body) => {
                    if(this.debug){
                        console.log("pair response: ", body);
                    }
                    if(typeof body.code != 'undefined'){
                        if(body.state == true){
                            
                            // Generate QR code
                            //console.log("generating QR code");
                            const target_element = document.getElementById('extension-homebridge-pairing-qr-code');
                            target_element.innerHTML = "";
                    	    var qrcode = new QRCode(target_element, {
                    		    width : 300,
                    		    height : 300
                    	    });
                    	    qrcode.makeCode(body.code);
                            
                            let pin_string = body.pin.toString();
                            
                            let formatted_pin = pin_string;
                            if(pin_string.length == 8){
                                formatted_pin = pin_string.substring(0,2) + " - " + pin_string.substring(3,4); + " - " + pin_string.substring(5,7); 
                            }
                            
                            // Show pin code under the QR code
                            document.getElementById('extension-homebridge-pairing-code').innerText = formatted_pin;
                            
                        }
                        else{
                            alert("One moment, Homebridge is not ready yet");
                        }
                        
                    }
				
		        }).catch((e) => {
		  			console.log("Error getting pairing code or generating QR code: ", e);
		        });	
                
			});
            
            
            
            // SEARCH BUTTON
            document.getElementById('extension-homebridge-search-button').addEventListener('click', (event) => {
                if(this.debug){
                    console.log("clicked on search button");
                }
                this.search();
			});
            
            
            
            // Button to show the second page
            
            document.getElementById('extension-homebridge-show-second-page-button').addEventListener('click', (event) => {
                console.log("clicked on + button");
                document.getElementById('extension-homebridge-content-container').classList.add('extension-homebridge-showing-second-page');
                
                // iPhones need this fix to make the back button lay on top of the main menu button
                document.getElementById('extension-homebridge-view').style.zIndex = '3';
			});
            
            
            
            // Back button, shows main page
            document.getElementById('extension-homebridge-back-button-container').addEventListener('click', (event) => {
                console.log("clicked on back button");
                document.getElementById('extension-homebridge-content-container').classList.remove('extension-homebridge-showing-second-page');
                
                // Undo the iphone fix, so that the main menu button is clickable again
                document.getElementById('extension-homebridge-view').style.zIndex = 'auto';
                
                this.get_init_data(); // repopulate the main page 
			});
            
            
            // Scroll the content container to the top
            document.getElementById('extension-homebridge-view').scrollTop = 0;
            
            // Finally, request the first data from the addon's API
            this.get_init_data();

			try{
				clearInterval(this.interval);
			}
			catch(e){
				//console.log("no interval to clear? " + e);
			}
            this.interval = setInterval( () => {
                this.get_init_data();
            },5000);
            
		}
		
	
		// This is called then the user navigates away from the addon. It's an opportunity to do some cleanup. To remove the HTML, for example, or stop running intervals.
		hide() {
			try{
				clearInterval(this.interval);
			}
			catch(e){
				//console.log("no interval to clear? " + e);
			}
		}
        
        
    
    
        //
        //  INIT
        //
        // This gets the first data from the addon API
        
        get_init_data(){
            
            // rate limiting, avoiding many requests to an unresponsive controller
            if(this.response_error_count > 10){
                this.response_error_count = 1;
            }
            this.response_error_count++;
            
            if(this.response_error_count < 3){
                
    			try{
				
    		  		// Init
    		        window.API.postJson(
    		          `/extensions/${this.id}/api/ajax`,
                        {'action':'init'}

    		        ).then((body) => {
                    
                        this.response_error_count = 0;
                        
                        // Hide loading spinner
                        document.getElementById('extension-homebridge-loading').classList.add('extension-homebridge-hidden');
                    
                        // Handle debug preference
                        if(typeof body.debug != 'undefined'){
                            this.debug = body.debug;
                            if(body.debug == true){
                                //console.log("Homebridge: debugging enabled. Init API result: ", body);
                            
                                if(document.getElementById('extension-homebridge-debug-warning') != null){
                                    document.getElementById('extension-homebridge-debug-warning').style.display = 'block';
                                }
                            }
                        }
                    
                        // Show or hide busy/failed installing area
                        if(typeof body.hb_installed != 'undefined'){
                            this.hb_installed = body['hb_installed'];
                            if(this.hb_installed == false){
                                document.getElementById('extension-homebridge-main-busy-installing').style.display = "block"; 
                            }
                            else{
                                document.getElementById('extension-homebridge-main-busy-installing').style.display = "none";
                            }
                        
                            if(body['hb_install_progress'] > 0){
                                document.getElementById('extension-homebridge-main-busy-installing-progress-bar').style.width = body['hb_install_progress'] + "%";
                            }
                            else{
                                document.getElementById('extension-homebridge-main-busy-installing').style.display = "none";
                                document.getElementById('extension-homebridge-main-installing-failed').style.display = "block";
                            }
                        
                            if(body['hb_install_progress'] == -2){
                                console.log("Homebridge: not enough available disk space to install. Uninstall some other addons or switch to a bigger SD card.");
                            }
                        
                            if(body['hb_install_progress'] == -40){
                                console.log("Homebridge download failed");
                            }
                        
                            if(body['hb_install_progress'] == -100){
                                console.log("Homebridge installation failed");
                            }
                        
                            if(body['hb_install_progress'] == 100){
                                if(this.debug){
                                    //console.log("Homebridge installation succeeded");
                                }
                                
                            }
                        
                        }
                    
                        if(typeof body.launched != 'undefined'){
                            if(body.launched == true){
                                if(this.debug){
                                    //console.log("Homebridge launched");
                                }
                            
                                // This will reveal all the elements that are only available once Homebridge is running
                                document.getElementById('extension-homebridge-content-container').classList.remove('extension-homebridge-not-launched-yet');
                            
                                // Create link to configuration interface
                                var config_url = "http://" + body.config_ip + ":" + body.config_port + "/plugins";
                                document.getElementById('extension-homebridge-config-ui-link').href = config_url;
                                document.getElementById('extension-homebridge-main-launched').style.display = 'block';
                                
                                
                                // Display the url
                                var readable_config_url = config_url;
                                if(typeof body.hostname != 'undefined'){
                                    const potential_hostname = body.hostname + ".local";
                                    //console.log("potential_hostname: ", potential_hostname);
                                    //console.log(window.location.href.indexOf(potential_hostname));
                                    if(window.location.href.indexOf(potential_hostname) > -1){
                                        //console.log("upgrading readable config url");
                                        readable_config_url = "http://" + potential_hostname + ":" + body.config_port;
                                    }
                                }
                                document.getElementById('extension-homebridge-config-ui-readable-link').innerText = readable_config_url;
                            
                                // show the pairing button
                                document.getElementById('extension-homebridge-show-pairing-button-container').style.display = 'block';
                            
                            }
                        }
                        
                    
                        /*
                        // Show the value of the number from the addon's settings
                        if(typeof body.a_number_setting != 'undefined'){
                            this.a_number_setting = body['a_number_setting'];
                            console.log("this.a_number_setting: ", this.a_number_setting);
                            document.getElementById('extension-homebridge-number-setting-output').innerText = body.a_number_setting; // body['a_number_setting'] and body.a_number_setting are two ways of writing the same thing 
                        }
                    
                        // Show the value of the slider
                        document.getElementById('extension-homebridge-slider-value-output').innerText = body.slider_value;
                    
                        // Generate the list of items
                        
                        */
                        if(typeof body.plugins_list != 'undefined'){
                            this.plugins = body['plugins_list'];
                            this.regenerate_plugins(body['plugins_list']);
                        }
				
    		        }).catch((e) => {
    		  			console.log("Homebridge: error getting init data: ", e);
    		        });	

    			}
    			catch(e){
    				console.log("Homebridge: error in API call to init: ", e);
    			}
                
            }
            else{
                if(this.debug){
                    console.warn("Homebridge addon API not responding? this.response_error_count: ", this.response_error_count);
                }
            }
			
        }
        
	
		//
		//  REGENERATE ITEMS LIST ON MAIN PAGE
		//
	
		regenerate_plugins(items){
            // This funcion takes a list of items and generates HTML from that, and places it in the list container on the main page
			try {
				if(this.debug){
                    //console.log("regenerating. items: ", items);
                }
                
                let list_el = document.getElementById('extension-homebridge-installed-plugins-output'); // list element
                if(list_el == null){
                    if(this.debug){
                        console.log("Homebridge: error, the main list container did not exist yet");
                    }
                    return;
                }
                
                // If the items list does not contain actual items, then stop
                if(items.length == 0){
                    list_el.innerHTML = "No items";
                    return
                }
                else{
                    list_el.innerHTML = "";
                    document.getElementById('extension-homebridge-installed-plugins-output-container').style.display = 'block';
                }
                
                // The original item which we'll clone  for each item that is needed in the list.  This makes it easier to design each item.
				const original = document.getElementById('extension-homebridge-original-item');
			    //console.log("original: ", original);
                
			    // Since each item has a name, here we're sorting the list based on that name first
				items.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase()) ? 1 : -1)
				
                
				// Loop over all items in the list to create HTML for each item. 
                // This is done by cloning an existing hidden HTML element, updating some of its values, and then appending it to the list element
				for( var item in items ){
					
					var clone = original.cloneNode(true); // Clone the original item
					clone.removeAttribute('id'); // Remove the ID from the clone
                    
                    // Place the name in the clone
                    clone.querySelector(".extension-homebridge-item-name").innerText = items[item].name; // The original and its clones use classnames to avoid having the same ID twice
                    clone.getElementsByClassName("extension-homebridge-item-value")[0].innerText = items[item].value; // another way to do the exact same thing - select the element by its class name
                    

					// ADD DELETE BUTTON
					const delete_button = clone.querySelectorAll('.extension-homebridge-item-delete-button')[0];
                    //console.log("delete button element: ", delete_button);
                    delete_button.setAttribute('data-name', items[item].name);
                    
					delete_button.addEventListener('click', (event) => {
                        console.log("delete button click. event: ", event);
                        if(confirm("Are you sure you want to delete this item?")){
    						
    						// Inform backend
    						window.API.postJson(
    							`/extensions/${this.id}/api/ajax`,
    							{'action':'delete_plugin','name': event.target.dataset.name}
    						).then((body) => { 
    							console.log("Homebridge: delete plugin response: ", body);
                                if(body.state == true){
                                    console.log('the item was deleted on the backend');
                                    
                                    event.target.closest(".extension-homebridge-item").style.display = 'none'; // find the parent item
                                    // Remove the item form the list, or regenerate the entire list instead
                                    // parent4.removeChild(parent3);
                                }

    						}).catch((e) => {
    							console.log("homebridge: error in delete items handler: ", e);
    						});
                        }
				  	});

                    // Add the clone to the list container
					list_el.append(clone);
                    
				} // end of for loop
            
			}
			catch (e) {
				console.log("Homebridge: error in regenerate_plugins: ", e);
			}
		}
	
 
 
        //
        //  SEARCH
        //
 
        search(){
            document.getElementById('extension-homebridge-search-output').innerHTML = "Searching...";
            document.getElementById('extension-homebridge-search-output').style.display = 'block';
            
            var search_query = document.getElementById('extension-homebridge-search-input').value;
            if(search_query.length > 25){
                search_query = search_query.substring(0,24);
            }
            search_query += " keywords:homebridge-plugin";
            const search_url = "https://registry.npmjs.org/-/v1/search?text=" + encodeURIComponent(search_query) + "&size=100&popularity=1";
            
            if(this.debug){
                console.log("search_url: ", search_url);
            }
            
            fetch(search_url)
            .then((response) => response.json())
            .then((json) => {
                if(this.debug){
                    console.log("GOT JSON!",json);
                }
                
                var found_a_plugin = false;
                
                document.getElementById('extension-homebridge-search-output').innerHTML = "";
                
                var output_div = document.createElement('div');
                for (var i = 0; i < json.objects.length; i++) {
                    
                    // filter out plugins on blacklist
                    var on_blacklist = false;
                    for (var j = 0; j < this.plugins_blacklist.length; j++) {
                        if(json.objects[i].package.name == this.plugins_blacklist[j]){
                            if(this.debug){
                                console.log("skipping homebridge plugin on blacklist");
                            }
                            on_blacklist = true;
                        }
                    }
                    if(on_blacklist){
                        if(this.debug){
                            console.log("skipping plugin on blacklist: ", json.objects[i].package.name);
                        }
                        continue;
                    }
                    
                    // filter out already installed plugins
                    var already_installed = false;
                    for (var j = 0; j < this.plugins.length; j++) {
                        if(json.objects[i].package.name == this.plugins[j]['name']){
                            console.log("this plugin is already installed: ", json.objects[i].package.name);
                            already_installed = true;
                        }
                    }
                    
                    //filter by keyword (superfluous)
                    if(typeof json.objects[i].package.keywords == 'undefined'){
                        if(this.debug){
                            console.log("skipping plugin without keywords: ", json.objects[i].package.name);
                        }
                        continue;
                    }
                    if(json.objects[i].package.keywords.indexOf("homebridge-plugin") == -1){
                        if(this.debug){
                            console.log("not a homebridge plugin: ", json.objects[i].package.name);
                        }
                        continue;
                    }
                    
                    found_a_plugin = true; // at least one valid plugin was found
                    
                    // create item
                    var item_div = document.createElement('div');
                    item_div.classList.add('extension-homebridge-search-item');
                    
                    // add information to item
                    item_div.innerHTML = "<h3>" + json.objects[i].package.name + "</h3><p>" + json.objects[i].package.description + "</p><p>Version: " + json.objects[i].package.version + "</p>";
                    if(typeof json.objects[i].package.links.homepage != 'undefined'){
                        if(!document.body.classList.contains('kiosk')){
                            item_div.innerHTML += '<p><a href="' + json.objects[i].package.links.homepage + '" target="blank">Homepage</a></p>';
                        }
                    }
                    
                    if(already_installed){
                        item_div.classList.add('extension-homebridge-search-item-already-installed');
                        item_div.innerHTML += '<p>Already installed</p>';
                    }
                    else{
                        // add install button
                        var item_install_button = document.createElement('button');
                        item_install_button.classList.add('extension-homebridge-search-item-install-button');
                        item_install_button.classList.add('text-button');
                        item_install_button.innerText = "Install";
                        const plugin_name = json.objects[i].package.name;
                        item_install_button.addEventListener('click', (event) => {
                            console.log("install button clicked. Plugin name: ", plugin_name);
                            const this_btn = event.target;
                            const this_btn_parent_item = this_btn.closest('.extension-homebridge-search-item');
                            if(this_btn_parent_item != null){
                                this_btn_parent_item.innerHTML = "<h3>Installing " + plugin_name + "...</h3><p>This should take a few minutes. Once complete you will have to restart Homebridge for plugins to load.</p>";
                                this_btn_parent_item.classList.add('extension-homebridge-search-item-being-installed');
                            }
                            //this_btn.closest('.extension-homebridge-search-item').innerHTML = "<h3>Installing " + plugin_name + "...</h3><p>This should take a few minutes. Once complete you will have to restart Homebridge for plugins to load.</p>";
                            //this_btn.closest('.extension-homebridge-search-item').classList.add('extension-homebridge-search-item-being-installed');
                        
            		  		// Get_pin
            		        window.API.postJson(
            		          `/extensions/${this.id}/api/ajax`,
                                {
                                'action':'install_plugin',
                                'name':plugin_name,
                                'version':'@latest'
                                }

            		        ).then((body) => {
                                if(this.debug){
                                    console.log("install_plugin response: ", body);
                                }
                                // if(body.state == true){
				
            		        }).catch((e) => {
            		  			console.log("Error calling install_plugin: ", e);
            		        });
                        
    			        });
                        const button_container_div = document.createElement('div');
                        button_container_div.classList.add('extension-homebridge-search-item-button-container');
                        button_container_div.append(item_install_button);
                        item_div.append(button_container_div);
                    }
                    
                    
                    // add item to output
                    output_div.append(item_div);
                }
                
                // was at least one plugin found?
                if(found_a_plugin){
                    document.getElementById('extension-homebridge-search-output').append(output_div);
                }
                else{
                    document.getElementById('extension-homebridge-search-output').innerHTML = "No search results";
                }
                
            });
        
        }
 
 
 
 
 
    
    }

	new Homebridge();
	
})();


