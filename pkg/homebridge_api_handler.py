import os
import subprocess

from gateway_addon import APIHandler, APIResponse


#
#  API HANDLER
#


class HomebridgeAPIHandler(APIHandler):
    """API handler."""

    def __init__(self, adapter, verbose=False):
        """Initialize the object."""
        print("INSIDE API HANDLER INIT")
        
        self.adapter = adapter
        self.DEBUG = self.adapter.DEBUG


        # Intiate extension addon API handler
        try:
            
            APIHandler.__init__(self, self.adapter.addon_name) # gives the api handler the same id as the adapter
            self.manager_proxy.add_api_handler(self) # tell the controller that the api handler now exists
            
        except Exception as e:
            print("Error: failed to init API handler: " + str(e))
        
        
    def handle_request(self, request):
        """
        Handle a new API request for this handler.

        request -- APIRequest object
        """
        
        try:
        
            if request.method != 'POST':
                return APIResponse(status=404) # we only accept POST requests
            
            if request.path == '/ajax': # you could have all kinds of paths. In this example we only use this one, and use the 'action' variable to denote what we want to api handler to do

                try:
                    action = str(request.body['action']) 
                    
                    if self.DEBUG:
                        print("API handler is being called. Action: " + str(action))
                        print("request.body: " + str(request.body))
                    
                        
                    # INIT
                    if action == 'init':
                        if self.DEBUG:
                            print("API: in init")
                            
                        try:
                            # Get safe values from the config file
                            hb_name = "Candle Homebridge"
                            if "bridge" in self.adapter.hb_config_data:
                                if "name" in self.adapter.hb_config_data["bridge"]:
                                    hb_name = self.adapter.hb_config_data["bridge"]["name"]
                            else:
                                if self.DEBUG:
                                    print('ERROR, config data did not have bridge object (yet).')
                                    
                            # Check if Homebridge is running
                            launched = False
                            hb_check = shell('ps aux | grep hb-ser')
                            if 'hb-service' in hb_check:
                                launched = True
                                
                        except Exception as ex:
                            if self.DEBUG:
                                print("Error getting name: " + str(ex))
                                
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps({
                                      'plugins_list':self.adapter.plugins_list,
                                      'hb_installed':self.adapter.hb_installed,
                                      'hb_install_progress':self.adapter.hb_install_progress,
                                      'launched':launched,
                                      'config_port':self.adapter.config_port,
                                      'hb_name':hb_name,
                                      'config_ip':self.adapter.ip,
                                      'hostname':self.adapter.hostname,
                                      'things':self.adapter.persistent_data['things'],
                                      'pi_camera_plugin_installed':self.adapter.pi_camera_plugin_installed,
                                      'debug':self.adapter.DEBUG
                                      }),
                        )
                
                    
                    
                    elif action == 'save_token':
                        if self.DEBUG:
                            print("API: in save_token")
                        
                        state = False
                        
                        try:
                            self.adapter.persistent_data['token'] = str(request.body['token'])
                            self.adapter.save_persistent_data()
                            if self.DEBUG:
                                print("saved token")
                            state = True
                            
                        except Exception as ex:
                            if self.DEBUG:
                                print("Error saving token: " + str(ex))
                        
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps({'state' : state}),
                        )
                    
                    
                    
                    elif action == 'save_things':
                        if self.DEBUG:
                            print("API: in save_things")
                        
                        state = False
                        
                        try:
                            self.adapter.persistent_data['things'] = request.body['things']
                            self.adapter.save_persistent_data()
                            if self.DEBUG:
                                print("saved new things list")
                            
                            # Update the config file
                            self.adapter.update_config_file()
                            state = True
                            
                            # restart Homebridge # TODO: make this less rough..
                            print("restarting homebridge")
                            self.adapter.run_hb()
                            #os.system('pkill homebridge')
                            
                            
                        except Exception as ex:
                            if self.DEBUG:
                                print("Error saving things: " + str(ex))
                        
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps({'state' : state}),
                        )
                    
                    
                    
                    # GET_PIN
                    # We should avoid sending this over the network too often, hence this special action
                    elif action == 'pair':
                        if self.DEBUG:
                            print("API: in pair")
                        state = False
                        
                        pin = ""
                        code = ""
                        try:
                            
                            if not "bridge" in self.adapter.hb_config_data:
                                if self.DEBUG:
                                    print("did not find bridge in hb_config_data. Perhaps first run? Updating config file first.")
                                self.adapter.update_config_file()
                            
                            if "bridge" in self.adapter.hb_config_data: # and len(self.adapter.setup_id) > 0:
                                
                                pin = self.adapter.hb_config_data["bridge"]["pin"]
                                
                                if self.adapter.qr_code_url == "":
                                    with open(self.adapter.hb_logs_file_path) as f: 
                                        hb_log = f.read().splitlines()
                                        for line in hb_log:
                                            #print("hb_log line: " + str(line))
                                            if line.startswith('X-HM:'):
                                                self.adapter.qr_code_url = str(line).rstrip()
                                                if self.DEBUG:
                                                    print("spotted QR code url in hb log file: " + str(self.adapter.qr_code_url))
                                code = self.adapter.qr_code_url
                                
                                if code != "":
                                    state = True
                                
                            else:
                                print("pair: (still) mising config data")
                                
                        except Exception as ex:
                            if self.DEBUG:
                                print("Error getting pairing info from config or log file: " + str(ex))

                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps({'state':state,'code':code,'pin':pin}),
                        )
                    
                        
                    # Reset Homebridge
                    elif action == 'reset_homebridge':
                        if self.DEBUG:
                            print("API: in reset_homebridge")
                        
                        state = False
                        
                        try:
                            state = self.adapter.reset_hb()
                            
                        except Exception as ex:
                            if self.DEBUG:
                                print("Error resetting Homebridge: " + str(ex))
                        
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps({'state':state}),
                        )
                        
                    
                    # (Re)Start Homebridge
                    elif action == 'start_homebridge':
                        if self.DEBUG:
                            print("API: in start_homebridge")
                        
                        state = False
                        
                        try:
                            self.adapter.run_hb()
                            state = True
                            
                        except Exception as ex:
                            if self.DEBUG:
                                print("Error (re)starting homebridge: " + str(ex))
                        
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps({'state':state}),
                        )
                    
                    
                    
                    # INSTALL PLUGIN
                    elif action == 'install_plugin':
                        if self.DEBUG:
                            print("API: in install_plugin")
    
                        state = False
    
                        try:
                            name = str(request.body['name'])
                            version = str(request.body['version'])
        
                            state = self.install_plugin(name,version) # This method returns True all the time..
        
                        except Exception as ex:
                            if self.DEBUG:
                                print("Error installing plugin: " + str(ex))
    
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps({'state' : state}),
                        )
                    
                    
                    # DELETE PLUGIN
                    elif action == 'delete_plugin':
                        if self.DEBUG:
                            print("API: in delete_plugin")
                        
                        state = False
                        
                        try:
                            name = str(request.body['name'])
                            
                            state = self.delete_plugin(name) # This method returns True if deletion was succesful
                            
                        except Exception as ex:
                            if self.DEBUG:
                                print("Error deleting: " + str(ex))
                        
                        return APIResponse(
                          status=200,
                          content_type='application/json',
                          content=json.dumps({'state' : state}),
                        )
                    
                    
                    else:
                        print("Error, that action is not possible")
                        return APIResponse(
                            status=404
                        )
                        
                except Exception as ex:
                    if self.DEBUG:
                        print("Ajax error: " + str(ex))
                    return APIResponse(
                        status=500,
                        content_type='application/json',
                        content=json.dumps({"error":"Error in API handler"}),
                    )
                    
            else:
                if self.DEBUG:
                    print("invalid path: " + str(request.path))
                return APIResponse(status=404)
                
        except Exception as e:
            if self.DEBUG:
                print("Failed to handle UX extension API request: " + str(e))
            return APIResponse(
                status=500,
                content_type='application/json',
                content=json.dumps({"error":"General API error"}),
            )
    
    
    
    # Install a new plugin
    def install_plugin(self,name,version="@latest"):
        plugin_name_full = str(name) + str(version)
        if self.DEBUG:
            print("in install_plugin. Name: " + str(name) + " -> " + str(plugin_name_full))
        
        p = subprocess.Popen([self.adapter.hb_npm_path,"install","--save",plugin_name_full], cwd=self.adapter.hb_plugins_path)
        p.wait()
        
        self.adapter.update_installed_plugins_list()
        
        
        if self.DEBUG:
            print("plugin should now be installed")
        
        self.quick_hb_restart()
        #self.run_hb()
        
        # Check if a directory with the plugin name now exists
        return os.path.isdir( os.path.join(self.adapter.hb_plugins_path,name) )
        #return True
    


    
    # Loop over all the items in the list, which is stored inside the adapter instance.
    def delete_plugin(self,name):
        if self.DEBUG:
            print("in delete_plugin. Name: " + str(name))
        
        # uninstall via npm here
        p = subprocess.Popen([self.adapter.hb_npm_path,"uninstall","--save",name], cwd=self.adapter.hb_plugins_path)
        p.wait()
        
        """
        for i in range(len(self.adapter.plugins_list)):
            if self.adapter.plugins_list[i]['name'] == name:
                # Found it
                del self.adapter.plugins_list[i]
                if self.DEBUG:
                    print("deleted plugin from list")
                return True
        """
        
        self.adapter.update_installed_plugins_list()
        
        return True