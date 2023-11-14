(function() {
	class Homebridge extends window.Extension {
	    constructor() {
	      	super('homebridge');
      		
            this.debug = false; // if enabled, show more output in the console
            this.response_error_count = 0;
            
            this.launched = false;
            
            this.all_things = [];
            this.selected_things = null;
            this.things_generated_once = false;
            
            this.properties_to_ignore = ["linkquality","data_transmission","data_blur","power_outage_memory"];
            this.all_potentials = {};
            
            this.plugins = [];
            this.plugins_blacklist = [
              'homebridge-config-ui',
              'homebridge-config-ui-rdp',
              'homebridge-rocket-smart-home-ui',
              'homebridge-ui',
              'homebridge-to-hoobs',
              'homebridge-server',
            ];
            
            this.pin_code = "";
            
            /*
            API.getThings().then((things) => {
                console.log('Homebridge:API: things: ', things);
            });
            
            API.getThing('energyuse').then((thing) => {
                console.log('Homebridge:API: thing: ', thing);
            });
            */
            
            
            setTimeout(() => {
                const jwt = localStorage.getItem('jwt');
                //console.log("jwt: ", jwt);
    	        window.API.postJson(
    	          `/extensions/${this.id}/api/ajax`,
    				{'action':'save_token','token':jwt}

    	        ).then((body) => {
                    //console.log("homebridge delayed update jwt response: ", body);
    	        }).catch((e) => {
    	  			console.log("Homebridge: error (delayed) saving token: ", e);
    	        });
            }, 5100);
            
            
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
            //console.log("HOMEBRIDGE SHOW");
            
			const main_view = document.getElementById('extension-homebridge-view');
			
			if(this.content == ''){
                //console.log("content has not loaded yet");
				return;
			}
			else{
				main_view.innerHTML = this.content;
			}
            
            
            try{
                // Save things button
                document.getElementById('extension-homebridge-save-things-button').addEventListener('click', (event) => {
                    if(this.debug){
                        console.log("Homebridge: save things button clicked");
                    }
                
                    document.getElementById('extension-homebridge-save-things-button').classList.add('extension-homebridge-hidden');
                    document.getElementById('extension-homebridge-save-things-hint').style.display = 'block';
                    
                    setTimeout(() => {
                        document.getElementById('extension-homebridge-save-things-hint').style.display = 'none';
                        document.getElementById('extension-homebridge-save-things-button').classList.remove('extension-homebridge-hidden');
                    }, "10000");
                
                    var selected_things = [];
                
                    var all_thing_items = document.querySelectorAll('.extension-homebridge-thing');
                    //console.log('all_thing_items:', all_thing_items);
                    for(var i=0; i<all_thing_items.length; i++){
                    
                        // Get checkbox state
                        let checkbox_el = all_thing_items[i].querySelector(".extension-homebridge-thing-checkbox");
                        //console.log("selected_things[i].dataset.device_id: ", all_thing_items[i]['dataset']['thing_id']);
                        //console.log("alt: ", all_thing_items[i].getAttribute('data-thing_id'));
                        
                        // Get dropdown selection
                        //let select_el = all_thing_items[i].querySelector(".extension-homebridge-thing-select");
                    
                        if(checkbox_el.checked){
                            //console.log("checked");
                        
                            let thing_title = checkbox_el.getAttribute('data-thing_title');
                        
                            let options_checkboxes = all_thing_items[i].querySelectorAll(".extension-homebridge-thing-options-checkbox:checked");
                            for(var k=0; k<options_checkboxes.length; k++){
                                //console.log("checkbox: ", options_checkboxes[k]);
                                let thing_id = options_checkboxes[k].getAttribute('data-thing_id');
                                let accessory_type = options_checkboxes[k].getAttribute('data-accessory_type');
                                let accessory_data = this.all_potentials[thing_id][accessory_type];
                                //console.log("accessory_data, thing_id, accessory_type: ", accessory_data, thing_id, accessory_type);
                            
                                selected_things.push( {
                                        "thing_id":thing_id,
                                        "thing_title":thing_title,
                                        //"accessory_type":accessory_type, // a little double
                                        "accessory_data":accessory_data} 
                                        );
                            }
                        
                        
                            //console.log("checked: ", all_thing_items[i].getAttribute('data-thing_id'));
                        
                        }
                        else{
                            //console.log("not checked");
                        }
                    
                    
                    }
                    //console.log("selected_things: ", selected_things);
                
                
    		  		// Save things
    		        window.API.postJson(
    		          `/extensions/${this.id}/api/ajax`,
                        {'action':'save_things','things':selected_things}

    		        ).then((body) => {
                        if(this.debug){
                            console.log('homebridge save_things response: ', body);
                        }
			
    		        }).catch((e) => {
    		  			console.log("Homebridge: error saving things list: ", e);
    		        });
                    
                });
            
            
                // ADD button press
                /*
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
                */
            
                // Easter egg when clicking on the title
    			document.getElementById('extension-homebridge-title').addEventListener('click', (event) => {
                    this.show();
    			});
            
                // Share camera button
    			document.getElementById('extension-homebridge-install-camera-button').addEventListener('click', (event) => {
                    if(this.debug){
                        console.log("share camera button clicked")
                    }
                    this.request_plugin_install("homebridge-camera-ffmpeg");
					document.getElementById('extension-homebridge-install-camera-button').style.display = 'none';
					document.getElementById('extension-homebridge-installing-camera-plugin').style.display = 'block';
					
                    document.getElementById('extension-homebridge-manual-add-tutorial-container').style.display = 'block';
					
					
    			});
                
                
                // RESET BUTTON
                document.getElementById('extension-homebridge-reset-button').addEventListener('click', (event) => {
                    if(this.debug){
                        console.log("clicked on reset button");
                    }
                    if(confirm("Are you sure you want to reset Homebridge?")){
                        document.getElementById('extension-homebridge-reset-button').style.display = 'none';
                        document.getElementById('extension-homebridge-doing-reset-hint').style.display = 'block';
                        document.getElementById('extension-homebridge-content-container').classList.add('extension-homebridge-not-launched-yet');
    				
                        // re-create the interval that checks if Homebridge has started
                        this.interval = setInterval( () => {
                            //console.log("reset interval timer");
                            this.get_init_data();
                        },5000);
                    
                        window.API.postJson(
        					`/extensions/${this.id}/api/ajax`,
        					{'action':'reset_homebridge'}
                    
        				).then((body) => {
                            if(this.debug){
                                console.log("Homebridge reset response: ", body);
                            }
                            if(body.state == true){
                                document.getElementById('extension-homebridge-doing-reset-hint').innerText = "Reset complete. Homebridge is stopped.";
                            
                                document.getElementById('extension-homebridge-reset-restart-container').style.display = 'block';
                            }
                            else{
                                alert("Homebridge reset failed?");
                            }
        				}).catch((e) => {
        					console.log("homebridge: connnection error after while requesting reset: ", e);
                            alert("Connnection error while requesting reset");
        				});
                    }
                    
    			});
                
                
                // Restart after reset button
    			document.getElementById('extension-homebridge-reset-restart-button').addEventListener('click', (event) => {
                    if(this.debug){
                        console.log("clicked on restart HB button");
                    }
                    this.start_homebridge();
    			});
                
            
                // SEARCH PLUGINS BUTTON
                document.getElementById('extension-homebridge-search-button').addEventListener('click', (event) => {
                    if(this.debug){
                        console.log("clicked on search button");
                    }
                    this.search();
    			});
            
            
                // Button to show the second page
                /*
                document.getElementById('extension-homebridge-show-second-page-button').addEventListener('click', (event) => {
                    if(this.debug){
                        console.log("clicked on + button");
                    }
                    document.getElementById('extension-homebridge-content-container').classList.add('extension-homebridge-showing-second-page');
                
                    // iPhones need this fix to make the back button lay on top of the main menu button
                    document.getElementById('extension-homebridge-view').style.zIndex = '3';
    			});
                
                // Back button, shows main page
                document.getElementById('extension-homebridge-back-button-container').addEventListener('click', (event) => {
                    if(this.debug){
                        console.log("clicked on back button");
                    }
                    document.getElementById('extension-homebridge-content-container').classList.remove('extension-homebridge-showing-second-page');
                
                    // Undo the iphone fix, so that the main menu button is clickable again
                    document.getElementById('extension-homebridge-view').style.zIndex = 'auto';
                
                    this.get_init_data(); // repopulate the main page 
    			});
                */
                
            }
            catch (e){
                console.error('Homebridge: error making buttons: ', e);
            }
            
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
         
         
         
            // TABS
            
            var all_tabs = document.querySelectorAll('.extension-homebridge-tab');
            //console.log('all_tabs:', all_tabs);
            var all_tab_buttons = document.querySelectorAll('.extension-homebridge-main-tab-button');
            //console.log('all_tab_buttons:', all_tab_buttons);
        
            for(var i=0; i< all_tab_buttons.length;i++){
                all_tab_buttons[i].addEventListener('click', (event) => {
        			//console.log("tab button clicked", event);
                    var desired_tab = event.target.innerText.toLowerCase();
                    
                    if(desired_tab == '?'){desired_tab = 'tutorial';}

                    //console.log("desired tab: " + desired_tab);
                    
                    for(var j=0; j<all_tabs.length;j++){
                        all_tabs[j].classList.add('extension-homebridge-hidden');
                        all_tab_buttons[j].classList.remove('extension-homebridge-tab-selected');
                    }
                    document.querySelector('#extension-homebridge-tab-button-' + desired_tab).classList.add('extension-homebridge-tab-selected'); // show tab
                    document.querySelector('#extension-homebridge-tab-' + desired_tab).classList.remove('extension-homebridge-hidden'); // show tab
                    
                    
                    if(desired_tab == 'things'){
                        this.show_things();
                    }
                    else if(desired_tab == 'pairing'){
                        this.show_pairing();
                    }
                    else if(desired_tab == 'plugins'){
                        this.show_plugins();
                    }
                    
                });
            };
         
            
            
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
        // This gets the first data from the addon API. Gets called every 5 seconds.
        
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
                        
                        // Reveal main tab menu
                        // document.getElementById('extension-homebridge-tab-buttons-container').style.display = 'flex';
                    
                        // Handle debug preference
                        if(typeof body.debug != 'undefined'){
                            this.debug = body.debug;
                            if(body.debug == true){
                                console.log("Homebridge: debugging enabled. Init API result: ", body);
                            
                                if(document.getElementById('extension-homebridge-debug-warning') != null){
                                    document.getElementById('extension-homebridge-debug-warning').style.display = 'block';
                                }
                            }
                        }
                        
                        
                        if(typeof body.hb_name != 'undefined'){
                            document.getElementById('extension-homebridge-name').innerText = body.hb_name;
                        }
                        
                        if(typeof body.launched != 'undefined'){
                            this.launched = body.launched;
                            if(body.launched == true){
                                if(this.debug){
                                    console.log("Homebridge launched");
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
                                //document.getElementById('extension-homebridge-show-pairing-button-container').style.display = 'block';
                            
                            
                                // Now that Homebridge has launched, clear the interval
                    			try{
                    				clearInterval(this.interval);
                    			}
                    			catch(e){
                    				//console.log("no interval to clear? " + e);
                    			}
                            }
                        }
                    
                        // Selected things
                        if(typeof body.things != 'undefined'){
                            this.selected_things = body['things'];
                            
                            // generate the things list automatically once if the necessary data is available
                            if(this.launched && this.things_generated_once == false){
                                this.things_generated_once == true;
                                this.show_things();
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
                    
                        if(typeof body.pi_camera_plugin_installed != 'undefined' && typeof body.camera_available != 'undefined'){
                            if(body.camera_available && !body.pi_camera_plugin_installed){
                                document.getElementById('extension-homebridge-camera-detected-container').classList.remove("extension-homebridge-hidden");
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
                            this.show_plugins();
                        }
				
    		        }).catch((e) => {
    		  			console.log("Homebridge: error getting init data: ", e);
    		        });	

    			}
    			catch(e){
    				console.log("Homebridge: error in API call to init: ", e);
    			}
                
                document.getElementById("extension-homebridge-disconnected-hint").classList.add("extension-homebridge-hidden");
            }
            else{
                if(this.debug){
                    console.warn("Homebridge addon API not responding? this.response_error_count: ", this.response_error_count);
                }
                document.getElementById("extension-homebridge-disconnected-hint").classList.remove("extension-homebridge-hidden");
            }
			
        }
        
        
        
        
        
	
		//
		//  REGENERATE PLUGINS LIST
		//
	
		show_plugins(items){
            // This funcion takes a list of items and generates HTML from that, and places it in the list container on the main page
			try {
				let items = this.plugins;
                
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
                    
                    let my_item = item;
					
                    
                    console.log("A items[item].name: ", items[item].name);
                    if(items[item].name != "homebridge-webthings"){
                        console.log("plugin is not homebridge-webthings");
                        
    					// ADD DELETE BUTTON
    					const delete_button = clone.querySelectorAll('.extension-homebridge-item-delete-button')[0];
                        //console.log("delete button element: ", delete_button);
                        delete_button.setAttribute('data-name', items[item].name);
                        
    					delete_button.addEventListener('click', (event) => {
                            if(this.debug){
                                console.log("delete button click. event: ", event);
                            }
                            
                            
                            console.log("delete: my_item: ", my_item);
                            console.log("items[my_item].name: ", items[my_item].name);
                            
                            if(items[my_item].name == "homebridge-webthings"){
                                alert("This plugin cannot be deleted because it is part of the Homebridge addon");
                            }
                            else{
                                if(confirm("Are you sure you want to delete this plugin?")){
    						
            						// Inform backend
            						window.API.postJson(
            							`/extensions/${this.id}/api/ajax`,
            							{'action':'delete_plugin','name': event.target.dataset.name}
            						).then((body) => { 
            							if(this.debug){
                                            console.log("Homebridge: delete plugin response: ", body);
                                        }
                                        if(body.state == true){
                                            if(this.debug){
                                                console.log('Homebridge plugin was succesfully deleted on the backend');
                                            }
                                    
                                            event.target.closest(".extension-homebridge-item").style.display = 'none'; // find the parent item
                                            // Remove the item form the list, or regenerate the entire list instead
                                            // parent4.removeChild(parent3);
                                        }
                                        //this.show_plugins();
                                        this.get_init_data();

            						}).catch((e) => {
            							console.log("homebridge: error in delete items handler: ", e);
            						});
                                }
                            }
                        
    				  	});
                    }
                    else{
                        console.log("plugin was homebridge-webthings, not adding listener to delete button");
                        clone.querySelector(".extension-homebridge-item-menu").style.display = 'none';
                        
                    }
					

                    // Add the clone to the list container
					list_el.append(clone);
                    
				} // end of for loop
            
			}
			catch (e) {
				console.log("Homebridge: error in show_plugins: ", e);
			}
		}
	
 
 
        //
        //  PLUGINS SEARCH
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
                    console.log("Got NPM search response: ", json);
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
                            if(this.debug){
                                console.log("this plugin is already installed: ", json.objects[i].package.name);
                            }
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
                        item_div.innerHTML += '<p style="text-align:right;font-style:italic">Already installed</p>';
                    }
                    else{
                        // add install button
                        var item_install_button = document.createElement('button');
                        item_install_button.classList.add('extension-homebridge-search-item-install-button');
                        item_install_button.classList.add('text-button');
                        item_install_button.innerText = "Install";
                        const plugin_name = json.objects[i].package.name;
                        item_install_button.addEventListener('click', (event) => {
                            if(this.debug){
                                console.log("install button clicked. Plugin name: ", plugin_name);
                            }
                            const this_btn = event.target;
                            const this_btn_parent_item = this_btn.closest('.extension-homebridge-search-item');
                            if(this_btn_parent_item != null){
                                this_btn_parent_item.innerHTML = "<h3>Installing " + plugin_name + "...</h3><p>This should take a few minutes. Once complete you will have to restart Homebridge for plugins to load.</p>";
                                this_btn_parent_item.classList.add('extension-homebridge-search-item-being-installed');
                            }
                            //this_btn.closest('.extension-homebridge-search-item').innerHTML = "<h3>Installing " + plugin_name + "...</h3><p>This should take a few minutes. Once complete you will have to restart Homebridge for plugins to load.</p>";
                            //this_btn.closest('.extension-homebridge-search-item').classList.add('extension-homebridge-search-item-being-installed');
                        
            		        this.request_install(plugin_name);
                        
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
 
 
 
        request_plugin_install(plugin_name){
            
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
                
                if(body.state == true){
                    //alert(plugin_name + " installed succesfully");
                    
                    if(typeof body.pin != 'undefined'){
                        
                        let pin_string = body.pin.toString();
                        
                        this.pin_code = pin_string;
                        if(pin_string.length == 8){
                            this.pin_code = pin_string.substring(0,3) + " - " + pin_string.substring(4,7);
                        }
                        
                        // Show pin code under the QR code
                        document.getElementById('extension-homebridge-pairing-pin-code').innerText = this.pin_code;
                    }
                    
                }
                else{
                    alert(plugin_name + " installation failed!");
                }

                //this.show_plugins();
                this.get_init_data();
                
	        }).catch((e) => {
	  			console.log("Error calling install_plugin: ", e);
	        });
            
        }
 
 
 
 
        //
        // SHOW THINGS
        //
 
    	show_things(action){
        
            //const pre = document.getElementById('extension-homebridge-response-data');
        
            const jwt = localStorage.getItem('jwt');
        
            
    	    API.getThings().then((things) => {
			    
                things.sort((a, b) => (a.title.toLowerCase() > b.title.toLowerCase()) ? 1 : -1) // sort alphabetically
                
                document.getElementById('extension-homebridge-thing-list').innerHTML = "";
                
    			this.all_things = things;
    			if(this.debug){
                    console.log("homebridge: debug: all things: ", things);
                }
			    
    			// pre-populate the hidden 'new' item with all the thing names
    			var thing_ids = [];
    			var thing_titles = [];
			
    			for (let key in things){

                    if( things[key].hasOwnProperty('properties') ){ // things without properties should be skipped (edge case)
                        
        				var thing_title = 'unknown';
        				if( things[key].hasOwnProperty('title') ){
        					thing_title = things[key]['title'];
        				}
        				else if( things[key].hasOwnProperty('label') ){ // very old addons sometimes used label instead of title
        					thing_title = things[key]['label'];
        				}
				
        				
        				
			
        				var thing_id = things[key]['href'].substr(things[key]['href'].lastIndexOf('/') + 1);
                        //console.log("thing_id: ", thing_id);
                        
                        if(thing_id == 'homebridge-thing'){
                            //console.log("FOUND IT homebridge-thing");
                            continue;
                        }
                        
                        if (thing_id.startsWith('highlights-') ){
    						//console.log(thing_id + " starts with highlight-, so skipping.");
    						continue;
                        }
                        
                        
                        
                        
                        //console.log("thing_title and ID: ", thing_title, thing_id);
        				//thing_ids.push( things[key]['href'].substr(things[key]['href'].lastIndexOf('/') + 1) );
                        

                        // item
                        var thing_container = document.createElement('div');
                        thing_container.classList.add('extension-homebridge-thing');
                        thing_container.dataset.thing_id = thing_id;
                    
                        // checkbox
                        var thing_checkbox = document.createElement('input');
                        thing_checkbox.type = "checkbox";
                        thing_checkbox.name = 'extension-homebridge-' + thing_id;
                        thing_checkbox.id = 'extension-homebridge-' + thing_id;
                        thing_checkbox.dataset.thing_id = thing_id;
                        thing_checkbox.dataset.thing_title = thing_title;
                        thing_checkbox.classList.add('extension-homebridge-thing-checkbox');
                    
                        // label
                        var thing_label = document.createElement('label');
                        thing_label.htmlFor = 'extension-homebridge-' + thing_id;
                        var thing_label_span = document.createElement('span');
                        thing_label_span.appendChild(document.createTextNode(thing_title));
                        thing_label.appendChild(thing_label_span);
                        
                        // options container
                        var options_el = document.createElement('div');
                        options_el.classList.add('extension-homebridge-thing-options');
                        options_el.innerHTML = '<p class="extension-homebridge-thing-options-hint">Share as:</p>';
                        
                        // select
                        /*
                        var select_el = document.createElement('select');
                        select_el.classList.add('extension-homebridge-thing-select');
                        select_el.classList.add('localization-select');
                        var selected_type = "";
                        var options_count = 0;
                        */
                        
                        
                        
                        if(this.selected_things != null){
                            if(this.selected_things.length > 0){
                                
                                // Set checkbox to checked
                                for(let s=0;s<this.selected_things.length;s++){
                            
                                    if(this.selected_things[s]['thing_id'] == thing_id){
                                        //console.log("setting checkbox checked for: ", thing_id);
                                        thing_checkbox.checked = true;
                                    
                                        // find which option(s) are enabled
                                        /*
                                        if( typeof this.selected_things[s]['selected_type'] != 'undefined'){
                                            //console.log("selected_type was not undefined. it is: ", this.selected_things[s]['selected_type']);
                                            if(this.selected_things[s]['selected_type'] != ""){
                                                selected_type = this.selected_things[s]['selected_type'];
                                                //console.log("selected type was already set in selected_things:", selected_type);
                                            }
                                        }
                                        else{
                                            //console.log("selected_type as undefined");
                                        }
                                        */
                                    }
                                }
                            }
                            
                            
                        }
                        else{
                            console.error("this.selected_things was still null. Aborting showing things list.");
                            return;
                        }  
                        //if(selected_type == ""){
                            //console.log("selected_type is still empty string");
                        //}
                        
                        
                        // Scan for all potential Homekit accessory types this thing could be shared as
                        let possible_accessories = {};
                        //if(thing_id.indexOf("z2m-0x086") != -1){
                            possible_accessories = this.find_accessory(thing_id);
                            if(Object.keys(possible_accessories).length == 0){
                                //console.warn("device had no potential homekit abilities. Skipping: ", thing_id);
                                continue;
                            }
                            this.all_potentials[thing_id] = possible_accessories;
                        //}
                        //console.log("\n\n\n--------------")
                        //console.log("possible_accessories: ", possible_accessories);
                        
                        var highest_preference_count_so_far = 0;
                        let pos_keys = Object.keys(possible_accessories);
                        var checkboxes_el = document.createElement('div');
                        checkboxes_el.classList.add('extension-homebridge-thing-checkboxes');
                        for(let u=0;u<pos_keys.length;u++){
                            //console.log("looping over possible accessories. pos_keys[u]: ", pos_keys[u]);
                            
                            // accessory checkbox
                            var accessory_checkbox = document.createElement('input');
                            accessory_checkbox.type = "checkbox";
                            accessory_checkbox.name = 'extension-homebridge-' + thing_id + "-" + pos_keys[u];
                            accessory_checkbox.id = 'extension-homebridge-' + thing_id + "-" + pos_keys[u];
                            accessory_checkbox.dataset.thing_id = thing_id;
                            accessory_checkbox.dataset.accessory_type = pos_keys[u];
                            accessory_checkbox.classList.add('extension-homebridge-thing-options-checkbox');
                            
                            
                            // Should the accessory checkbox be checked?
                            for(let s=0;s<this.selected_things.length;s++){
                                if(this.selected_things[s]['thing_id'] == thing_id){
                                    if( this.selected_things[s].accessory_data.homekit_type == pos_keys[u]){
                                        accessory_checkbox.checked = true;
                                    }
                                    
                                }
                            }
                            
                            
                            // accessory label
                            var accessory_label = document.createElement('label');
                            accessory_label.htmlFor = 'extension-homebridge-' + thing_id + "-" + pos_keys[u];
                            var accessory_label_span = document.createElement('span');
                            accessory_label_span.appendChild(document.createTextNode(this.camelcase_to_human_readable(pos_keys[u])));
                            accessory_label.appendChild(accessory_label_span);
                            
                            checkboxes_el.appendChild(accessory_checkbox);
                            checkboxes_el.appendChild(accessory_label);
                            
                        }
                        
                        options_el.appendChild(checkboxes_el);
                        
                        
                        
                        //let possible_accessories = this.find_accessory(thing_id,selected_type);
                        //break;
                        
                        /*
                        if(typeof things[key]['@type'] != 'undefined'){
                            if(things[key]['@type'].length > 0){
                                //console.log("there is at least one thing capability available");

                                for(let a=0;a<things[key]['@type'].length;a++){
                                    options_count++;

                                    //var option_el = new Option(things[key]['@type'][a], things[key]['@type'][a]);

                                    let option_el = document.createElement('option');
                                        option_el.value = things[key]['@type'][a];
                                        option_el.innerHTML = things[key]['@type'][a];

                                    if(typeof things[key]['selectedCapability'] != 'undefined'){
                                        if(things[key]['selectedCapability'].length > 0){
                                            //console.log("capability: ", things[key]['@type'][a]);
                                            if(things[key]['@type'][a] == things[key]['selectedCapability']){
                                                //console.log("this is the thing's selectedCapability: ", things[key]['selectedCapability']);
                                                if(selected_type == ""){
                                                    //console.log("setting selected capability to selected option:", things[key]['selectedCapability']);
                                                    option_el.selected = true;
                                                }
                                            }
                                        }

                                    }
                                    select_el.appendChild(option_el);
                                }
                            }
                            else{
                                console.warn("@type length was zero for: ", things[key]['title']);
                            }
                        }
                        else{
                            console.warn("no @type defined");
                        }
                        */
                        //const type_options = this.find_accessory(thing_id,selected_type);
                        
                        //if(options_count > 0){
                            // Append parts to item
                            thing_container.appendChild(thing_checkbox);
                            thing_container.appendChild(thing_label);
                            
                            //options_el.appendChild(select_el);
                            thing_container.appendChild(options_el);
                            /*
                            if(options_count > 1){
                                thing_container.appendChild(select_el);
                            }
                            else{
                                let span_el = document.createElement("span");
                                span_el.classList.add('extension-homebridge-thing-one-option');
                                span_el.innerHTML = "(only one option)";
                                thing_container.appendChild(span_el);
                            }
                            */

                            //thing_container.appendChild(properties_container);

                            // Append item to the dom
                            document.getElementById('extension-homebridge-thing-list').appendChild(thing_container);
                        //}
                        
                    }
                }
                
                //console.log("ALL POTENTIALS: ", this.all_potentials);
                
            });
        
    	}
 
 
 
 
 
        
        
        
        
        
        
 
 
 
 
        // FIND ACCESSORY
        // A helper method to find the most optimal/likely Homekit accessory types
 
        find_accessory(thing_id){
            
            const ac_map = [
                
                // Temperature sensor
                {
                    "homekit_type":"temperatureSensor",
                    "webthings_type":["TemperatureSensor"],
                    "preference_score":40,
                    "required":
                    [
                        {
                            "property_at_type":"TemperatureProperty",
                            "property_name":"temperature",
                            "config_names":["getCurrentTemperature"]
                        }
                    ]
                },
                
                // Humidity sensor
                {
                    "homekit_type":"humiditySensor",
                    "webthings_type":["HumiditySensor"],
                    "preference_score":30,
                    "required":
                    [
                        {
                            "property_at_type":"HumidityProperty",
                            "property_name":"humidity",
                            "config_names":["getCurrentRelativeHumidity"],
                            "required_unit":"percentage",
                            "required_variable":"integer",
                        }
                    ]
                },
                
                // Weather Station
                {
                    "homekit_type":"weatherStation",
                    "webthings_type":["TemperatureSensor","HumiditySensor","BarometricPressureSensor","MultiLevelSensor"],
                    "preference_score":50,
                    "required":
                    [
                        {
                            "property_at_type":"TemperatureProperty",
                            "property_name":"temperature",
                            "config_names":["getCurrentTemperature"]
                        }
                    ],
                    "optional":
                    [
                        {
                            "property_at_type":"HumidityProperty",
                            "property_name":"humidity",
                            "config_names":["getCurrentRelativeHumidity"],
                            "required_unit":"percentage",
                            "required_variable":"integer",
                        },
                        {
                            "required_unit":"lx",
                            "read_only":true,
                            "config_names":["getCurrentAmbientLightLevel"]
                        },
                        {
                            "required_unit":"description",
                            "read_only":true,
                            "config_names":["getWeatherCondition"]
                        },
                        {
                            "property_at_type":"BarometricPressureProperty",
                            "read_only":true,
                            "config_names":["getAirPressure"]
                        },
                        {
                            "property_name":"wind direction",
                            "read_only":true,
                            "config_names":["getWindDirection"]
                        },
                        {
                            "property_name":"wind speed",
                            "read_only":true,
                            "config_names":["getWindSpeed"]
                        }
                    ]
                },
                
                // Thermostat
                {
                    "homekit_type":"thermostat",
                    "webthings_type":["Thermostat"],
                    "preference_score":100,
                    "required":
                    [
                        {
                            "property_name":"mode",
                            "config_names":["getCurrentHeatingCoolingState"],
                            "required_variable":"enum",
                            "extra_attributes":{"heatingCoolingStateValues":["off","heat","cool","auto"],"restrictHeatingCoolingState":[0, 1]}
                        },
                        {
                            "property_at_type":"TargetTemperatureProperty",
                            "property_name":"setpoint",
                            "config_names":["getTargetTemperature","setTargetTemperature"]
                        },
                        {
                            "property_at_type":"HeatingCoolingProperty",
                            "property_name":"running state",
                            "config_names":["getTargetHeatingCoolingState","setTargetHeatingCoolingState"],
                            //"extra_attributes":{"restrictHeatingCoolingState":["off","heating"]}
                        }
                    ],
                    "optional":[
                        {
                            "property_name":"unit",
                            "required_variable":"strings",
                            "config_names":["getTemperatureDisplayUnits","setTemperatureDisplayUnits"]
                        }
                    ]
                },
                
                
                
                
                // carbon Dioxide Sensor
                {
                    "homekit_type":"carbonDioxideSensor",
                    "webthings_type":["AirQualitySensor"],
                    "preference_score":90,
                    "required":
                    [
                        {
                            "config_names":["getCarbonDioxideDetected"],
                            "required_variable":"enum",
                            "extra_attributes":{"carbonDioxideDetectedValues": [ "ok", "bad" ]}
                        },
                        
                    ],
                    "optional":[
                        {
                            "property_at_type":"ConcentrationProperty",
                            "config_names":["getCarbonDioxideLevel"],
                            "required_unit":"ppm",
                        }
                    ]
                },
                
                
                
                // air Quality Sensor
                {
                    "homekit_type":"airQualitySensor",
                    "webthings_type":["AirQualitySensor"],
                    "preference_score":90,
                    "required":
                    [
                        {
                            "property_name":"quality",
                            "config_names":["getAirQuality"],
                            "required_variable":"enum",
                            "extra_attributes":{"airQualityValues":["unknown","excellent","good","poor","moderate","unhealthy"]}
                        }
                    ],
                    "optional":[
                        {
                            "property_at_type":"DensityProperty",
                            "property_name":"2",
                            "config_names":["getPM2_5Density"],
                        },
                        {
                            "property_at_type":"ConcentrationProperty",
                            "config_names":["getAirQualityPPM"],
                            "required_unit":"ppm",
                        },
                        {
                            "property_name":"voc",
                            "config_names":["getVOCDensity"]
                        },
                        {
                            "property_name":"co2",
                            "config_names":["getCarbonDioxideLevel"]
                        },
                        {
                            "property_name":"nox",
                            "config_names":["getNitrogenDioxideDensity"]
                        },
                        {
                            "property_at_type":"TemperatureProperty",
                            "property_name":"temperature",
                            "config_names":["getCurrentTemperature"]
                        },
                        {
                            "property_at_type":"HumidityProperty",
                            "property_name":"humidity",
                            "config_names":["getCurrentRelativeHumidity"],
                            "required_unit":"percentage",
                            "required_variable":"integer",
                        }
                    
                    ]
                },
                
                // air Purifier
                {
                    "homekit_type":"airPurifier",
                    "webthings_type":["OnOffSwitch"],
                    "preference_score":100,
                    "required":
                    [
                        {
                            "property_at_type":"OnOffProperty",
                            "property_name":"state",
                            "config_names":["getActive","setActive"]
                        },
                        {
                            "property_name":"mode",
                            "config_names":["getCurrentAirPurifierState"],
                            "required_variable":"enum",
                            "extra_attributes":{"currentAirPurifierStateValues":["off","auto","3"]}
                        },
                        {
                            "property_name":"mode",
                            "config_names":["getTargetAirPurifierState","setTargetAirPurifierState"],
                            "required_variable":"enum",
                            "extra_attributes":{"targetAirPurifierStateValues":["3","auto"]}
                        }
                    ],
                    "optional":[
                        {
                            "property_name":"filter",
                            "config_names":["getFilterChangeIndication"],
                            "required_variable":"boolean",
                        },
                        {
                            "property_name":"child lock",
                            "config_names":["setLockPhysicalControls"],
                            "required_variable":"boolean",
                        },
                        {
                            "property_name":"speed",
                            "config_names":["getRotationSpeed","setRotationSpeed"]
                        },
                        /*
                        {
                            "property_name":"filter age",
                            "config_names":["getFilterLifeLevel"], // has to percentage of life remaining. Which depends on the device?
                            "required_variable":"integer",
                        }
                        */
                    ]
                },
                
                // lightBulb
                {
                    "homekit_type":"lightbulb",
                    "webthings_type":["Light","MultiLevelSwitch","ColorControl"],
                    "preference_score":100,
                    "required":
                    [
                        {
                            "property_at_type":"OnOffProperty",
                            "property_name":"state",
                            "config_names":["getOn","setOn"]
                        }
                    ],
                    "optional":[
                        {
                            "property_at_type":"BrightnessProperty",
                            "property_name":"brightness",
                            "config_names":["getBrightness","setBrightness"],
                            "required_unit":"percentage",
                            "required_variable":"integer",
                        },
                        // Radio hack
                        {
                            "property_at_type":"LevelProperty",
                            "property_name":"volume",
                            "config_names":["getBrightness","setBrightness"],
                            "required_unit":"percentage",
                            "required_variable":"integer",
                        },
                        {
                            "property_at_type":"ColorProperty",
                            "property_name":"color",
                            "config_names":["getRGB","setRGB"],
                            "required_variable":"string",
                            "extra_attributes":{"hex":true,"hexPrefix":"#"}
                        }
                    ]
                },
                
                // Light sensor
                {
                    "homekit_type":"lightSensor",
                    "webthings_type":["MultiLevelSensor"],
                    "preference_score":30,
                    "required":
                    [
                        {
                            "required_unit":"lx",
                            "read_only":true,
                            "config_names":["getCurrentAmbientLightLevel"]
                        },
                    ]
                },
                
                // Lock
                {
                    "homekit_type":"lockMechanism",
                    "webthings_type":["Lock"],
                    "preference_score":70,
                    "required":
                    [
                        {
                            "property_at_type":"LockedProperty",
                            "property_name":"state",
                            "config_names":["getLockTargetState","setLockTargetState","getLockCurrentState"]
                        }
                    ]
                },
                
                // Window
                // technically all these properties are required...
                {
                    "homekit_type":"window",
                    "webthings_type":["MultiLevelSwitch"],
                    "preference_score":70,
                    "required":
                    [
                        {
                            "property_name":"state",
                            "config_names":["getPositionState"],
                            "extra_attributes":{"minPosition": 0,"maxPosition": 100, "positionStateValues": [ "OPEN", "CLOSE", "STOP" ]}
                        },
                        {
                            "property_at_type":"LevelProperty",
                            "property_name":"position",
                            "config_names":["getCurrentPosition","setTargetPosition"],
                            "required_variable":"integer"
                        },
                        {
                            "property_name":"hold",
                            "config_names":["setHoldPosition"],
                            "required_variable":"boolean"
                        },
                        {
                            "property_name":"obstruction", // obstruction
                            "config_names":["getObstructionDetected"],
                            "required_variable":"boolean",
                            "read_only":true
                        }
                    ]
                },
                
                // Garage door opener
                {
                    "homekit_type":"garageDoorOpener",
                    "webthings_type":["OnOffSwitch"],
                    "preference_score":20,
                    "required":
                    [
                        {
                            "property_at_type":"OnOffProperty",
                            "property_name":"state",
                            "config_names":["getTargetDoorState","setTargetDoorState","getCurrentDoorState"]
                        }
                    ]
                },
                
                // Doorbell
                /*
                {
                    "homekit_type":"doorbell",
                    "webthings_type":["PushButton"],
                    "preference_score":30,
                    "required":
                    [
                        {
                            "property_at_type":"PushedProperty",
                            "property_name":"state",
                            "config_names":["getSwitch"],
                            "read_only":true,
                            "required_variable":"string",
                            "extra_attributes":{"switchValues": [ "on", "off", "brightness_move_up" ],"restrictSwitchValues": [0]}
                        }
                    ],
                    "optional":[
                        {
                            "property_at_type":"BrightnessProperty",
                            "property_name":"brightness",
                            "config_names":["getBrightness","setBrightness"],
                            "required_unit":"percentage",
                            "required_variable":"integer",
                        },
                        {
                            "property_at_type":"",
                            "property_name":"volume",
                            "config_names":["getVolume","setVolume"]
                        },
                        {
                            "property_at_type":"MotionProperty",
                            "property_name":"state",
                            "config_names":["getMotionDetected"],
                            "read_only":true
                        }
                    ]
                
                },
                */
                
                // Fan
                {
                    "homekit_type":"fan",
                    "webthings_type":["OnOffSwitch"],
                    "preference_score":80,
                    "required":
                    [
                        {
                            "property_at_type":"OnOffProperty",
                            "property_name":"state",
                            "config_names":["getOn","setOn"]
                        }
                    ]
                },
                
                // Motion sensor
                {
                    "homekit_type":"motionSensor",
                    "webthings_type":["MotionSensor","BinarySensor"],
                    "preference_score":60,
                    "required":
                    [
                        {
                            "property_at_type":"MotionProperty",
                            "property_name":"state",
                            "config_names":["getMotionDetected"],
                            "read_only":true
                        }
                    ],
                    "optional":[
                        {
                            "property_name":"tamper",
                            "config_names":["getStatusTampered"],
                            "required_variable":"boolean",
                        }
                    ]
                },
                
                // Occupancy sensor
                {
                    "homekit_type":"occupancySensor",
                    "webthings_type":["BinarySensor","MotionSensor"],
                    "preference_score":50,
                    "required":
                    [
                        {
                            "property_at_type":"BooleanProperty",
                            "property_name":"state",
                            "config_names":["getOccupancyDetected"],
                            "read_only":true
                        }
                    ],
                    "optional":[
                        {
                            "property_name":"tamper",
                            "config_names":["getStatusTampered"],
                            "required_variable":"boolean",
                        }
                    ]
                },
                
                // Contact sensor
                {
                    "homekit_type":"contactSensor",
                    "webthings_type":["BinarySensor"],
                    "preference_score":50,
                    "required":
                    [
                        {
                            "property_at_type":"BooleanProperty",
                            "property_name":"state",
                            "config_names":["getContactSensorState"],
                            "read_only":true
                        }
                    ],
                    "optional":[
                        {
                            "property_name":"tamper",
                            "config_names":["getStatusTampered"],
                            "required_variable":"boolean",
                        }
                    ]
                },
                
                // Switch
                {
                    "homekit_type":"switch",
                    "webthings_type":["OnOffSwitch","SmartPlug"],
                    "preference_score":65,
                    "required":
                    [
                        {
                            "property_at_type":"OnOffProperty",
                            "property_name":"state",
                            "config_names":["getOn","setOn"]
                        }
                    ],
                },
                
                // Outlet
                {
                    "homekit_type":"outlet",
                    "webthings_type":["OnOffSwitch","SmartPlug"],
                    "preference_score":90,
                    "required":
                    [
                        {
                            "property_at_type":"OnOffProperty",
                            "property_name":"state",
                            "config_names":["getOn","setOn"]
                        }
                    ],
                    "optional":[
                        {
                            "property_at_type":"InstantaneousPowerProperty",
                            "property_name":"watt",
                            "config_names":["getWatts"],
                            "required_unit":"watt"
                        },
                        {
                            "property_at_type":"VoltageProperty",
                            "property_name":"volt",
                            "config_names":["getVolts"],
                            "required_variable":"volt",
                        },
                        {
                            "property_at_type":"CurrentProperty",
                            "property_name":"ampere",
                            "config_names":["getAmperes"],
                            "required_unit":"ampere",
                        },
                        {
                            "property_name":"total",
                            "config_names":["getTotalConsumption"],
                            "required_unit":"kwh",
                        },
                    ]
                },
                
                // Smoke sensor
                {
                    "homekit_type":"smokeSensor",
                    "webthings_type":["SmokeSensor","BinarySensor"],
                    "preference_score":100,
                    "required":
                    [
                        {
                            "property_at_type":"SmokeProperty",
                            "property_name":"",
                            "config_names":["getSmokeDetected"]
                        }
                    ],
                    "optional":[
                        {
                            "property_name":"tamper",
                            "config_names":["getStatusTampered"],
                            "required_variable":"boolean",
                        }
                    ]
                },
                
                // Speaker
                // Seems the Homekit app doesn't fully support this
                /*
                {
                    "homekit_type":"speaker",
                    "webthings_type":["MultiLevelSwitch"],
                    "preference_score":10,
                    "required":
                    [
                        {
                            "property_at_type":"OnOffProperty",
                            "property_name":"playing",
                            "config_names":["getMute","setMute"]
                        },
                        {
                            "property_at_type":"LevelProperty",
                            "property_name":"volume",
                            "config_names":["getVolume","setVolume"],
                            "required_variable":"integer"
                        }
                    ]
                }
                */
                
            ]
            
                
            
            
            for(let i=0;i<this.all_things.length;i++){
                if(this.all_things[i]['href'].endsWith("/" + thing_id)){
                    //console.log("found the thing: ", this.all_things[i]);
                    //console.log("it has x properties: ", Object.keys(this.all_things[i]['properties']).length);
                    
                    
                    let potentials = {};
                    let thing_title = this.all_things[i]['title']
                    
                    if(this.debug){
                        //console.log("\n\n\n\n\n=\n==\n===");
                        //console.log("thing title: ", thing_title);
                    }
                    
                    
                    for(let m=0;m<ac_map.length;m++){
                        
                        const schema = ac_map[m];       // accessory schema
                        const dev = this.all_things[i]; // device object
                        //console.log("schema:", schema);
                        //console.log("dev:", dev);
                        try{
                            
                            var all_required_available = true;
                            
                            // Check if there is a capability match
                            // TODO: could there be devices without useful capabilities that should still be made available to Homekit? E.g. Display
                            if(typeof schema.webthings_type != 'undefined' && typeof dev['@type'] != 'undefined'){
                                
                                for(let w=0; w<schema.webthings_type.length; w++){ // loop over multiple allowed thing capabilities for this accessory type

                                    if(dev['@type'].indexOf(schema.webthings_type[w]) > -1  || (thing_title.toLowerCase().endsWith(' light') && schema.homekit_type == 'lightbulb') ){
                                        //console.log("thing capability match with this homekit schema: ", schema.homekit_type);
                                        
                                        //console.log("this schema has x required properties: ", schema.required.length);
                                        var matched_required_properties = 0;
                                        var used_property_at_types = [];
                                        var potent = {"services":[],"extras":[]}; // will hold all the details to go into the final potentials dictionary
                                        var preference_score = schema.preference_score; // the highter the number, the more likely that this is the one the user is looking for
                                        var serv_type = "required";
                                        
                                        //console.log("serv.length: ", serv.length);
                                        
                                        // For hacking later
                                        //var required_endpoints_list = []; // keep track of the required endpoints Homekit required
                                        //var found_endpoints_list = []; // keep track of the required endpoints that were found
                                        var missing_required_endpoints = []; // keep track of the required endpoints that were not found
                                        var filled_endpoints = [];
                                        
                                        // Loop over all the potential services
                                        const serv = ['optional','required']; // service parts.
                                        for(let q=0; q<serv.length; q++){
                                            
                                            serv_type = serv[q];
                                            //console.log("serv_type: ", serv_type);
                                            
                                            if(typeof schema[serv_type] == 'undefined'){ // not all Homekit devices have optional endpoints
                                                //console.warn('schema did not have list:', serv_type ); 
                                                continue;
                                            }
                                            
                                            
                                            // LOOP OVER REQUIRED AND OPTIONAL LISTS
                                            for(let r=0; r<schema[serv_type].length; r++){ //going over required or optional list of properties
                                                //console.log("schema[serv_type][" + r + "] prop: ", schema[serv_type][r]);
                                                //schema[serv_type][r];
                                            
                                                if(this.debug){
                                                    //console.log(".\n.\nhomebridge debug: serv_type:", serv_type);
                                                    //console.log("homebridge debug: schema: ", schema[serv_type][r]);
                                                }
                                                
                                                // LOOP OVER THING PROPERTIES
                                                // loop over all the properties to make sure the required properties to pipe to Homekit endpoints are available
                                                for(let j=0;j<Object.keys(this.all_things[i]['properties']).length;j++){
                                                    
                                                    let key_id = Object.keys(this.all_things[i]['properties'])[j];
                                                    //console.log("key_id: ", key_id);
                                                    
                                                    // Skip properties that are not relevant for Homekit
                                                    var should_skip = false;
                                                    for(let y=0;y<this.properties_to_ignore.length;y++){
                                                        if(key_id.endsWith(this.properties_to_ignore[y])){
                                                            should_skip = true;
                                                            break;
                                                        }
                                                    }
                                                    if(should_skip){
                                                        //console.log('skipping: ', key_id);
                                                        continue;
                                                    }
                                                    
                                                    let prop = this.all_things[i]['properties'][key_id];
                                                    var might_work = 0;
                                                
                                                    //console.log("prop: ", prop);
                                                
                                                    // compare property @types if possible, since that's the best possible match
                                                    if(typeof schema[serv_type][r]['property_at_type'] != 'undefined' && typeof prop['@type'] != 'undefined'){
                                                        //console.log(serv_type + "  schema and prop have @type defined: ", schema[serv_type][r]['property_at_type'], prop['@type']);
                                                        if(schema[serv_type][r]['property_at_type'] == prop['@type']){
                                                            //console.log("required property @type match: ", prop['@type']);
                                                            
                                                            if(used_property_at_types.indexOf(prop['@type']) == -1){ // make sure each property @type is only counted once...
                                                                used_property_at_types.push(prop['@type']);
                                                                might_work = 2;
                                                            }
                                                        }
                                                    }
                                                    
                                                    // If there is no @type match, it might still be the correct property
                                                    if(might_work == 0 && typeof schema[serv_type][r]['property_at_type'] == 'undefined'){
                                                        
                                                        //console.log(serv_type + " schema has no @type defined: ", key_id, schema[serv_type][r]);
                                                        //console.log("prop:", prop);
                                                        
                                                        // Look for NAME
                                                        if(typeof schema[serv_type][r]['property_name'] != 'undefined'){
                                                            if(prop['title'].toLowerCase().indexOf(schema[serv_type][r]['property_name']) > -1){
                                                                //console.log('(partial) name match: ', prop['title'], schema[serv_type][r]['property_name']);
                                                                might_work++;
                                                                might_work++;
                                                            }
                                                            else{
                                                                might_work = -3; // can negate an earlier title match
                                                            }
                                                        }
                                                        
                                                        // Look for UNIT.  
                                                        // Checking for unit string might be finicky, as even within the webthings standard there are multiple ways to decribe these string (e.g. "percentage" and "%")
                                                        if(typeof schema[serv_type][r]['required_unit'] != 'undefined' && typeof prop['unit'] != 'undefined'){
                                                            //console.log("required unit is set: ", schema[serv_type][r]['required_unit']);
                                                            if( prop['unit'].toLowerCase() == schema[serv_type][r]['required_unit'].toLowerCase() ){
                                                                //console.log("perfect unit match: ", prop['unit']);
                                                                might_work++;
                                                            }
                                                            else{
                                                                might_work--;
                                                            }
                                                        }
                                                        
                                                        // handle a VARIABLE TYPE indicator in the schema. E.g. "boolean" or "integer"
                                                        if(typeof schema[serv_type][r]['required_variable'] != 'undefined'){
                                                            //console.log("required variable is set: ", schema[serv_type][r]['required_variable']);
                                                            // Complicated method of testing if enum strings that homekit needs are available in the property
                                                            if(schema[serv_type][r]['required_variable'] == 'enum' && typeof prop['enum'] != 'undefined'){
                                                                //console.log("enum spotted in property");
                                                                
                                                                if(typeof schema[serv_type][r]['extra_attributes'] != 'undefined'){
                                                                    if(Object.keys(schema[serv_type][r]['extra_attributes']).length == 1){
                                                                        let enum_test_key = Object.keys(schema[serv_type][r]['extra_attributes'])[0];
                                                                        //console.log("enum_test_key: ", enum_test_key);
                                                                        if (Symbol.iterator in Object(schema[serv_type][r]['extra_attributes'][enum_test_key])) {
                                                                            //console.log("extra is single iterable");
                                                                            var all_in_enum = true;
                                                                            for(let p=0;p<schema[serv_type][r]['extra_attributes'][enum_test_key].length;p++){
                                                                                let enum_item = schema[serv_type][r]['extra_attributes'][enum_test_key][p];
                                                                                //console.log("enum_item: ", enum_item);
                                                                                if(prop['enum'].indexOf(enum_item) == -1){
                                                                                    if(this.debug){
                                                                                        //console.log("not found in enum: ", enum_item, prop['enum']);
                                                                                    }
                                                                                    all_in_enum = false;
                                                                                    might_work = -3;
                                                                                    break;
                                                                                }
                                                                            }
                                                                            if(all_in_enum){
                                                                                //console.log("all_in_enum?", all_in_enum);
                                                                                might_work++;
                                                                                might_work++;
                                                                            }
                                                                            else{
                                                                                //console.log("not all in enum");
                                                                            }
                                                                        }
                                                                        else{
                                                                            might_work++;
                                                                        }
                                                                        
                                                                    }
                                                                    else{
                                                                        might_work++;
                                                                    }
                                                                    
                                                                    
                                                                }
                                                                else{
                                                                    might_work++;
                                                                }
                                                            }
                                                            // test for all types except enum
                                                            else if(prop['type'] == schema[serv_type][r]['required_variable']){
                                                                //console.log("property required variable type match: ", prop['type']);
                                                                might_work++;
                                                                might_work++;
                                                            }
                                                            else{
                                                                //console.log('wrong variable type: ' + prop['type']);
                                                                might_work = -3; // can negate an earlier title match
                                                            }
                                                        }
                                                        
                                                        //if(might_work > 0){
                                                        //  console.log("might_work: ", might_work, prop['title'], dev['title']);
                                                        //}
                                                        
                                                    }
                                                    
                                                    
                                                    if(might_work > 0){
                                                        //console.log("might_work: ", might_work, prop['title'], dev['title']);
                                                        
                                                        var endpoint_already_taken = false;
                                                        for(let g=0;g<schema[serv_type][r]['config_names'].length;g++){
                                                            if( filled_endpoints.indexOf(schema[serv_type][r]['config_names'][g]) > -1 ){
                                                                endpoint_already_taken = true;
                                                            }
                                                        }
                                                       
                                                        if(!endpoint_already_taken){
                                                            if(serv_type == 'required'){
                                                                //console.log("increasing matched_required_properties");
                                                                matched_required_properties++;
                                                            }
                                                            //console.error(schema.homekit_type, " matched_required_properties: " +  matched_required_properties + " of " + schema.required.length);
                                                        
                                                            preference_score = preference_score + 10; // the more matched properties, the higher the score
                                                            potent['homekit_type'] = schema.homekit_type;
                                                            potent['preference_score'] = preference_score;
                                                            //potent['services'].push(schema[serv_type],prop);
                                                            for(let t=0;t<schema[serv_type][r]['config_names'].length;t++){
                                                                //console.log("adding service to potential accessory: ", schema[serv_type][r]['config_names'][t]);
                                                                potent['services'].push( {'config_name':schema[serv_type][r]['config_names'][t],"thing_id":thing_id,"property_id":key_id} );
                                                                filled_endpoints.push( schema[serv_type][r]['config_names'][t] ); // remember that this endpoint is now taken
                                                            }
                                                            if(typeof schema[serv_type][r]['extra_attributes'] != 'undefined'){
                                                                //console.log("adding extra attributes to potential accessory");
                                                                potent['extras'].push( schema[serv_type][r]['extra_attributes'] );
                                                            }
                                                        }
                                                        
                                                    }
                                                    else{
                                                        // Remember which required endpoints are missing for hacking later
                                                        if(serv_type == 'required'){
                                                            for(let t=0;t<schema[serv_type][r]['config_names'].length;t++){
                                                                if(missing_required_endpoints.indexOf(schema[serv_type][r]['config_names'][t]) == -1){
                                                                    missing_required_endpoints.push(schema[serv_type][r]['config_names'][t]);
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        
                                        }
                                        
                                        // isn't serv_type always "required" when we arrive here?
                                        //console.log("\n\n------------- WHAT DID WE GET? -------------");
                                        if(serv_type == 'required'){
                                            if(matched_required_properties == schema[serv_type].length){
                                                if(this.debug){
                                                    //console.warn(schema.homekit_type, " M A T C H count with required properties. Matched: ", matched_required_properties, potent);
                                                }
                                                potentials[schema.homekit_type] = potent;
                                            }
                                            else{
                                                if(this.debug){
                                                    //console.warn(schema.homekit_type, " not a match, only got " +  matched_required_properties + " of " + schema[serv_type].length, potent);
                                                }
                                                //console.log("XXX filled_endpoints: ", filled_endpoints);
                                                if(missing_required_endpoints.length > 0 && filled_endpoints.length > 0){ // make sure we're on the last run of the for loop that goes over required properties/endpoints
                                                    
                                                    
                                                    
                                                    // HACKING
                                                    // Here we can do some hacking to create extra "ghost" properties that don't really exist in order to increase Homekit compatibility
                                                
                                                    // First, create an easy to scan list of endpoints that are available
                                                    // TODO: would keeping track of which of these endpoints are required vs optional be useful here?
                                                    
                                                    //var filled_endpoints = [];
                                                    //for(let h=0;h<potent['services'].length;h++){
                                                    //    filled_endpoints.push( potent['services'][h]['config_name'] );
                                                    //}
                                                    //console.log("hacking: filled_endpoints: ", filled_endpoints);
                                                    //console.log("missing_required_endpoints: ", missing_required_endpoints);
                                                    
                                                    
                                                    // Small helper function to find out which property was used in the services info, 
                                                    // as it seems this info is not available in mqttlib.js
                                                    function find_property_for_endpoint(potent,endpoint){
                                                        for(let e=0;e<potent['services'].length;e++){
                                                            if(potent['services'][e]['config_name'] == endpoint){
                                                                return potent['services'][e]['property_id'];
                                                            }
                                                        }
                                                        return null
                                                    }
                                                    
                                                    // Go over all missing endpoints
                                                    var hacks_count = 0;
                                                    for(let m=0;m<missing_required_endpoints.length;m++){
                                                        const missing = missing_required_endpoints[m];
                                                        //console.log(schema.homekit_type, "  has missing: ", missing, ' perhaps reconstruct from ', filled_endpoints);
                                                
                                                        //console.log("schema.homekit_type: ", schema.homekit_type);
                                                    
                                                        // airQualitySensor opinion
                                                        if(schema.homekit_type == 'airQualitySensor'){
                                                            if(missing == 'getAirQuality' && filled_endpoints.indexOf('getPM2_5Density') > -1){
                                                                if(this.debug){
                                                                    console.log("Hacking: could calculate air quality opinion on the fly from pm25");
                                                                }
                                                                const src_property_id = find_property_for_endpoint(potent,'getPM2_5Density');
                                                                if(src_property_id != null){
                                                                    potent['services'].push( {'config_name':'getAirQuality',"thing_id":thing_id,"property_id":"homebridge-fake-" + hacks_count} );
                                                                    potent['extras'].push( {'hack':{'type':'generate','src':src_property_id ,'from':'getPM2_5Density','to':'getAirQuality','nr':hacks_count,'thresholds':[null,0,10,20,40,100] }} );
                                                                    potent['extras'].push( {"airQualityValues":["unknown","excellent","good","ok","poor","unhealthy"]} );
                                                                    hacks_count++;
                                                                }   
                                                            }
                                                            else if(missing == 'getAirQuality' && filled_endpoints.indexOf('getCarbonDioxideLevel') > -1){
                                                                if(this.debug){
                                                                    console.log("Hacking: could calculate air quality opinion on the fly from carbon dioxide level");
                                                                }
                                                                const src_property_id = find_property_for_endpoint(potent,'getCarbonDioxideLevel');
                                                                if(src_property_id != null){
                                                                    potent['services'].push( {'config_name':'getAirQuality',"thing_id":thing_id,"property_id":"homebridge-fake-" + hacks_count} );
                                                                    potent['extras'].push( {'hack':{'type':'generate', 'src':src_property_id, 'from':'getCarbonDioxideLevel','to':'getAirQuality','nr':hacks_count,'thresholds':[null,0,600,800,1000,1500] }} );
                                                                    potent['extras'].push( {"airQualityValues":["unknown","excellent","good","ok","poor","unhealthy"]} );
                                                                    hacks_count++;
                                                                }
                                                            }
                                                        }
                                                        
                                                        // carbonDioxideSensor opinion
                                                        else if(schema.homekit_type == 'carbonDioxideSensor'){
                                                            
                                                            if(missing == 'getCarbonDioxideDetected' && filled_endpoints.indexOf('getCarbonDioxideLevel') > -1){
                                                                if(this.debug){
                                                                    console.log("Hacking: could calculate carbon dioxide quality opinion on the fly from carbon dioxide level");
                                                                }
                                                                const src_property_id = find_property_for_endpoint(potent,'getCarbonDioxideLevel');
                                                                if(src_property_id != null){
                                                                    potent['services'].push( {'config_name':'getCarbonDioxideDetected',"thing_id":thing_id,"property_id":"homebridge-fake-" + hacks_count} );
                                                                    potent['extras'].push( {'hack':{'type':'generate', 'src':src_property_id, 'from':'getCarbonDioxideLevel','to':'getCarbonDioxideDetected','nr':hacks_count,'thresholds':[0,1000] }} );
                                                                    potent['extras'].push( {"carbonDioxideDetectedValues":["normal","bad"]} );
                                                                    hacks_count++;
                                                                }
                                                            }
                                                            
                                                        }
                                                    }
                                                    if(hacks_count == missing_required_endpoints.length){
                                                        if(this.debug){
                                                            console.log("Found enough hacks to complete the device: ", hacks_count);
                                                        }
                                                        potentials[schema.homekit_type] = potent;
                                                    
                                                    }else{
                                                        if(this.debug){
                                                            //console.warn('not enough hacks found to complete the device: ', hacks_count, " of ", missing_required_endpoints.length, missing_required_endpoints);
                                                        }
                                                    }
                                                    
                                                }
                                                
                                            }
                                        }
                                        
                                    }
                                }
                            }
                            
                        }
                        catch (e){
                            console.log("Error parsing AC: ", e);
                        }
                        
                    }
                    //console.log("scanned potentials: ", potentials);
                    return potentials;
                    
                }
            }
            
        }
 
 
 
        // PAIR
 
        show_pairing(){
            
	  		// Get_pin
	        window.API.postJson(
	          `/extensions/${this.id}/api/ajax`,
                {'action':'pair'}

	        ).then((body) => {
                if(this.debug){
                    console.log("pair response: ", body);
                }
                if(typeof body.state != 'undefined' && typeof body.code != 'undefined'){
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
                        
                        this.pin_code = pin_string;
                        if(pin_string.length == 8){
                            //formatted_pin = pin_string.substring(0,2) + " - " + pin_string.substring(3,4); + " - " + pin_string.substring(5,7); 
                            this.pin_code = pin_string.substring(0,3) + " - " + pin_string.substring(4,7); 
                            
                        }
                        
                        // Show pin code under the QR code
                        document.getElementById('extension-homebridge-pairing-code').innerText = this.pin_code;
                        
                    }
                    else{
                        alert("One moment, Homebridge is not ready yet");
                    }
                    
                }
			
	        }).catch((e) => {
	  			console.log("Error getting pairing code or generating QR code: ", e);
	        });	
        }
 
        
        
        
        start_homebridge(){
            
	        window.API.postJson(
	          `/extensions/${this.id}/api/ajax`,
                {'action':'start_homebridge'}

	        ).then((body) => {
                if(this.debug){
                    console.log("start response: ", body);
                }
                if(typeof body.state != 'undefined'){
                    if(body.state == true){
                        console.log("Homebridge start requested succesfully");
                        document.getElementById('extension-homebridge-reset-restart-container').style.display = 'none';
                    }
                    else{
                        alert("Error, requesting Homebridge start failed");
                    }
                }
			
	        }).catch((e) => {
	  			console.log("Error requesting Homebridge start: ", e);
	        });	
        }
        
        
        camelcase_to_human_readable(name) {
            
            function capitalize(word) {
                return word.charAt(0).toUpperCase() + word.substring(1);
            }
            
            var words = name.match(/[A-Za-z][a-z]*/g) || [];
            return words.map(capitalize).join(" ");
        }
 
    
    }

	new Homebridge();
	
})();


