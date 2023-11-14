"""
Candle Homebridge Addon
https://www.candlesmarthome.com
"""


import os
import sys

sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib')) 

import json
import time
import random
import socket
import urllib.request as urlreq
#import datetime
#import requests  # noqa
import threading
import selectors
import subprocess

#from BaseHTTPServer import BaseHTTPRequestHandler,HTTPServer

from gateway_addon import Database, Adapter
from .homebridge_device import HomebridgeDevice
from .homebridge_api_handler import HomebridgeAPIHandler
#from .homebridge_device import HomebridgeDevice

# GPIO
try:
    import RPi.GPIO as GPIO
except Exception as ex:
    print("Error, could not load RPi.GPIO: " + str(ex))

# This addon does not load part from other files, but if you had a big addon you might want to split it into separate parts. For example, you could have a file called "homebridge_api_handler.py" at the same level as homebridge.py, and import it like this:
#try:
#    from .homebridge_device import *
#    print("Device and Property imported")
#except Exception as ex:
#    print("Error, unable to load Device and Property: " + str(ex))


# Not sure what this is used for, but leave it in.
_TIMEOUT = 3

# Not sure what this is used for either, but leave it in.
_CONFIG_PATHS = [
    os.path.join(os.path.expanduser('~'), '.webthings', 'config'),
]

# Not sure what this is used for either, but leave it in.
if 'WEBTHINGS_HOME' in os.environ:
    _CONFIG_PATHS.insert(0, os.path.join(os.environ['WEBTHINGS_HOME'], 'config'))









class HomebridgeAdapter(Adapter):
    """Adapter for addon """

    def __init__(self, verbose=False):
        """
        Initialize the object.

        verbose -- whether or not to enable verbose logging
        """
        
        print("Starting adapter init")

        self.ready = False # set this to True once the init process is complete.
        self.addon_name = 'homebridge'
        
        self.name = self.__class__.__name__ # TODO: is this needed?
        Adapter.__init__(self, self.addon_name, self.addon_name, verbose=verbose)

        
        self.running = True
        self.DEBUG = False
        
        self.plugins_list = []

        # Homebridge
        self.hb_installed = False
        self.busy_intalling_hb = False
        self.hb_install_progress = 0

        self.launched = False
        self.hb_config_data = {}
        self.hb_name = "Candle Homebridge"
        self.hb_process_pid = None
        self.qr_code_url = ""
        self.config_port = 8581
        self.ip = get_ip()
        self.hostname = socket.gethostname()

        self.setup_id = ""

        # Homebridge thread
        self.hb_thread = None
        self.hb_process = None


        
        # Create some path strings. These point to locations on the drive.
        self.addon_path = os.path.join(self.user_profile['addonsDir'], self.addon_name) # addonsDir points to the directory that holds all the addons (/home/pi/.webthings/addons).
        self.data_path = os.path.join(self.user_profile['dataDir'], self.addon_name)
        self.persistence_file_path = os.path.join(self.data_path, 'persistence.json') # dataDir points to the directory where the addons are allowed to store their data (/home/pi/.webthings/data)
        
        self.hb_path = os.path.join(self.data_path, "hb")
        #print("self.hb_path: " + str(self.hb_path))
        
        self.hb_node_path = os.path.join(self.hb_path, "opt","homebridge","bin","node")
        self.hb_npm_path = os.path.join(self.hb_path, "opt","homebridge","bin","npm")
        self.hb_service_path = os.path.join(self.hb_path, "opt","homebridge","lib","node_modules","homebridge-config-ui-x","dist/bin/hb-service.js")
        
        self.hb_plugins_path = os.path.join(self.hb_path, "var","lib","homebridge","node_modules") 
        self.hb_webthings_plugin_path = os.path.join(self.hb_plugins_path, "homebridge-webthings")
        self.hb_camera_plugin_path = os.path.join(self.hb_plugins_path, "homebridge-camera-ffmpeg")

        self.hb_storage_path = self.data_path #os.path.join(self.hb_path, "var","lib","homebridge") # TODO: just make this the data root path for optimal backup support?
        self.hb_logs_file_path = os.path.join(self.hb_storage_path, "homebridge.log") 
        self.hb_config_file_path = os.path.join(self.hb_storage_path, "config.json")
        
        self.streamer_path = os.path.join(self.addon_path, "streamer")
        self.mediamtx_binary_path = os.path.join(self.streamer_path, "mediamtx")
        self.not_streaming_thumbnail_path = os.path.join(self.addon_path, "images", "candle_closed_eye_x1920.jpg")
        self.privacy_streaming_thumbnail_path = os.path.join(self.addon_path, "images", "candle_open_eye_x1920.jpg")
        #print("self.hb_service_path: " + str(self.hb_service_path))
        #print("self.hb_logs_file_path: " + str(self.hb_logs_file_path))
        #print("self.hb_config_file_path: " + str(self.hb_config_file_path))
        #print("self.hb_webthings_plugin_path: " + str(self.hb_webthings_plugin_path))
        
        # Create the data directory if it doesn't exist yet
        if not os.path.isdir(self.data_path):
            print("making missing data directory")
            os.mkdir(self.data_path)
            
        # Create the hb directory if it doesn't exist yet
        if not os.path.isdir(self.hb_path):
            print("making missing hb directory")
            os.mkdir(self.hb_path)
            
        # Check if homebridge is already installed
        if os.path.isfile(self.hb_service_path):
            #print("Homebridge is installed")
            self.hb_installed = True
            self.hb_install_progress = 100
        
        # Clear previous log
        if os.path.isfile(self.hb_logs_file_path):
            os.system('echo "" > '  + str(self.hb_logs_file_path))
        
        # Place the not-streaming thumbnail in the tmp directory
        os.system('cp ' + str(self.not_streaming_thumbnail_path) + ' /tmp/homebridge_thumbnail.jpg')
        
        
        
        # Get persistent data
        self.persistent_data = {}
        try:
            with open(self.persistence_file_path) as f:
                self.persistent_data = json.load(f)
                if self.DEBUG:
                    print('self.persistent_data was loaded from file: ' + str(self.persistent_data))
                    
        except:
            if self.DEBUG:
                print("Could not load persistent data (if you just installed the add-on then this is normal)")

        if 'token' not in self.persistent_data:
            self.persistent_data['token'] = "No token provided yet"

        if 'things' not in self.persistent_data:
            self.persistent_data['things'] = []

        if 'streaming' not in self.persistent_data:
            self.persistent_data['streaming'] = True
            
        if 'camera_resolution' not in self.persistent_data:
            self.persistent_data['camera_resolution'] = "Recommended (480p)"
        
        if 'privacy_preview' not in self.persistent_data:
            self.persistent_data['privacy_preview'] = False
        
        # Doorbell button
        self.doorbell_port = 8559
        self.use_doorbell_button = False
        self.doorbell_button_pin = 17
        self.doorbell_relay_pin = None
        self.doorbell_url = 'http://localhost:' + str(self.doorbell_port) + '/doorbell?Candle%20camera'
        self.voice_card_detected = False
        self.doorbell_button_initialized = False
        if os.path.isdir("/etc/voicecard"):
            self.voice_card_detected = True
        
        # ReSpeaker hat
        self.has_respeaker_hat = False
        aplay_output = shell('aplay -l')
        print(str(aplay_output))
        if 'seeed' in aplay_output.lower():
            print("ReSpeaker hat spotted")
        
        
        
        # Camera
        self.available_resolutions = []
        self.camera_hd_capable = False
        self.previous_camera_resolution = None
        self.pi_camera_available = False
        self.pi_camera_plugin_installed = False
        self.pi_camera_started = False
        
        self.check_camera() # Check which camera resolutions are available
        
        # Camera MediaMTX RTSP streaming server
        self.rtsp_port = 8554
        self.s = None
        self.stream_process = None
        self.stream_process = None
        
        # Camera thumbnail
        self.thumbnail_interval = 20 # seconds between taking thumbnail pictures
        self.last_thumbnail_time = 0
        self.thumbnail_server_port = 8552
        self.thumbnail_server_thread = None
        self.privacy_preview_placed = False
        
        self.unbridge_camera = False # faster if set to True, but more hassle for the end user
        self.camera_config = {
                                "name": "Camera FFmpeg", 
                                "porthttp": self.doorbell_port, 
                                "cameras": [
                                                {
                                                "name": "Candle camera", 
                                                "manufacturer": "Candle", 
                                                "doorbell": True, 
                                                "switches": True, 
                                                "unbridge": False, 
                                                "videoConfig": 
                                                        {
                                                        "source": "-i rtsp://localhost:" + str(self.rtsp_port) + "/pi", 
                                                        "stillImageSource": "-i http://localhost:" + str(self.thumbnail_server_port) + "/thumbnail.jpg", 
                                                        "maxWidth": 640, 
                                                        "maxHeight": 480, 
                                                        "maxFPS": 10,
                                                        "forceMax": True,
                                                        "additionalCommandline": "-x264-params intra-refresh=1:bframes=0",
                                                        "audio": False,
                                                        "≈": False
                                                        }
                                                }
                                            ], 
                                "platform": "Camera-ffmpeg"
                            }
                            
                            
        
                            
        
        # ring doorbell by requesting:
        # http://hostname:8559/doorbell?Candle%20camera
        # http://localhost:8559/doorbell?Candle%20camera
        
        
        
        
        
        # TEMPORARY DEBUG
        #self.has_respeaker_hat = True
        
        
        
        
            

        
        try:
            self.add_from_config()
        except Exception as ex:
            print("Error loading config: " + str(ex))
            
        
        # create list of installed plugins
        self.update_installed_plugins_list()

        # Start the API handler. This will allow the user interface to connect
        try:
            if self.DEBUG:
                print("starting api handler")
            self.api_handler = HomebridgeAPIHandler(self, verbose=True)
            if self.DEBUG:
                print("Adapter: API handler initiated")
        except Exception as e:
            if self.DEBUG:
                print("Error, failed to start API handler: " + str(e))


        # Create the thing
        try:
            #if self.has_respeaker_hat:
            if self.pi_camera_plugin_installed and self.pi_camera_available: 
                # Create the device object
                homebridge_device = HomebridgeDevice(self)
            
                # Tell the controller about the new device that was created. This will add the new device to self.devices too
                self.handle_device_added(homebridge_device)
            
                if self.DEBUG:
                    print("homebridge_device created")
                
                # You can set the device to connected or disconnected. If it's in disconnected state the thing will visually be translucent.
                self.devices['homebridge-thing'].connected = True
                self.devices['homebridge-thing'].connected_notify(True)

        except Exception as ex:
            print("Could not create homebridge thing: " + str(ex))

            
        # Start the camera (if available and enabled)
        if self.pi_camera_plugin_installed and self.pi_camera_available: 
            if self.persistent_data['streaming']:
                if self.DEBUG:
                    print("starting the MediaMTX RTSP streamer")
                    self.start_camera()
        
            # start the camera thumbnail server
            try:
                if self.DEBUG:
                    print("starting the thumbnail taker thread")
                self.thumbnail_taker_thread = threading.Thread(target=self.thumbnail_taker)
                self.thumbnail_taker_thread.daemon = True
                self.thumbnail_taker_thread.start()
            
                if self.DEBUG:
                    print("starting the thumbnail server thread")
                self.thumbnail_server_thread = threading.Thread(target=self.start_thumbnail_server)
                self.thumbnail_server_thread.daemon = True
                self.thumbnail_server_thread.start()
            except:
                if self.DEBUG:
                    print("Error starting the thumbnail taker or server thread")
                    
        
        # Start Homebridge
        if self.hb_installed == False:
            print("INSTALLING HOMEBRIDGE")
            self.install_hb()
        else:
            time.sleep(2)
            if self.DEBUG:
                print("init: Homebridge seems to be installed. Calling run_hb")
            self.run_hb()
        
        
        
        
        # Just in case any new values were created in the persistent data store, let's save if to disk
        self.save_persistent_data()
        
        # The addon is now ready
        self.ready = True 
        
        if self.DEBUG:
            print("homebridge init done")


    def add_from_config(self):
        """ This retrieves the addon settings from the controller """
        #print("in add_from_config")
        try:
            database = Database(self.addon_name)
            if not database.open():
                print("Error. Could not open settings database")
                return

            config = database.load_config()
            database.close()

        except:
            print("Error. Failed to open settings database. Closing proxy.")
            self.close_proxy() # this will purposefully "crash" the addon. It will then we restarted in two seconds, in the hope that the database is no longer locked by then
            return
            
        try:
            if not config:
                print("Warning, no config.")
                return

            # Let's start by setting the user's preference about debugging, so we can use that preference to output extra debugging information
            if 'Debugging' in config:
                self.DEBUG = bool(config['Debugging'])
                if self.DEBUG:
                    print("Debugging enabled")

            if self.DEBUG:
                print(str(config)) # Print the entire config data
                
            if 'Privacy protecting camera preview' in config:
                self.persistent_data['privacy_preview'] = bool(config['Privacy protecting camera preview'])
                if self.DEBUG:
                    print("Privacy protecting camera preview preference was in config: " + str(self.persistent_data['privacy_preview']))
            
            
            if 'Doorbell button GPIO pin' in config:
                self.doorbell_button_pin = int(config['Doorbell button GPIO pin'])
                if self.DEBUG:
                    print("Doorbell button pin preference was in config: " + str(self.doorbell_button_pin))
            
            """
            if 'Doorbell relay GPIO pin' in config:
                if(len(config['Doorbell relay GPIO pin']) > 0):
                    self.doorbell_relay_pin = int(config['Doorbell relay GPIO pin'])
                    if self.DEBUG:
                        print("Doorbell relay pin preference was in config: " + str(self.doorbell_relay_pin))
            """
            
            if 'Enable doorbell button' in config:
                self.use_doorbell_button = bool(config['Enable doorbell button'])
                if self.DEBUG:
                    print("Doorbell button enabled preference was in config: " + str(self.use_doorbell_button))
                    
            if 'Separate the camera' in config:
                self.unbridge_camera = bool(config['Separate the camera'])
                if self.DEBUG:
                    print("Separate the camera preference was in config: " + str(self.unbridge_camera))
            
            #if "Homebridge name" in config:
            #    self.hb_name = str(config["Homebridge name"])
            #    if self.DEBUG:
            #        print("Homebridge name preference was in config: " + str(self.hb_name))
            

        except Exception as ex:
            print("Error in add_from_config: " + str(ex))





    #
    #   CAMERA
    #
    
    def check_camera(self):
        
        # Check if the plugin is installed
        if os.path.isdir(self.hb_camera_plugin_path):
            if self.DEBUG:
                print("camera plugin seems to be installed")
            self.pi_camera_plugin_installed = True
        
        # Check is a camera is detected    
        cam_check = shell("libcamera-vid --list-cameras")
        
        if '640x480' in cam_check:
            if self.DEBUG:
                print("camera is capable of 640x480")
            self.pi_camera_available = True
            self.available_resolutions.append('Recommended (480p)')
            if self.persistent_data['camera_resolution'] == None:
                self.persistent_data['camera_resolution'] = 'Recommended (480p)'

        
        if '1920' in cam_check:
            if self.DEBUG:
                print("camera is capable of full HD")
            self.pi_camera_available = True
            self.camera_hd_capable = True
            self.available_resolutions.append('Full HD (1080p)')
            if self.persistent_data['camera_resolution'] == None:
                self.persistent_data['camera_resolution'] = 'Full HD (1080p)'
            
            # remember the initial resolution, so that the Homebridge server is only restarted if the resolution changes
            self.previous_camera_resolution = self.persistent_data['camera_resolution']

        
        
        
    def stop_camera(self):
        if self.DEBUG:
            print("in stop_camera")
        if self.stream_process != None:
            self.stream_process.terminate()
            time.sleep(2)
        os.system('pkill mediamtx')
        time.sleep(1)
        self.stream_process = None
        self.c = None
        os.system('cp ' + str(self.not_streaming_thumbnail_path) + ' /tmp/homebridge_thumbnail.jpg')



        
    def start_camera(self):
        if self.persistent_data['streaming']:
            if self.pi_camera_plugin_installed and self.pi_camera_available:
                if self.DEBUG:
                    print("starting the camera thread for Pi Ribbon Camera")
                try:
                    self.really_start_camera()
                    #self.c = threading.Thread(target=self.really_start_camera)
                    #self.c.daemon = True
                    #self.c.start()
                except:
                    if self.DEBUG:
                        print("Error starting the camera thread")
            else:
                if self.DEBUG:
                    print("camera is disabled, not starting it")

        if self.use_doorbell_button and self.doorbell_button_initialized == False:
            if self.DEBUG:
                print("use_doorbell_button is true, enabling GPIO")
            self.doorbell_button_initialized = True
            #if self.has_respeaker_hat == True:
            # Button (pin 17)
            GPIO.setmode(GPIO.BCM) # Use BCM pin numbering
            GPIO.setup(self.doorbell_button_pin, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)
            #GPIO.setup(17, GPIO.IN)
            GPIO.add_event_detect(self.doorbell_button_pin, GPIO.RISING, callback=self.dingdong, bouncetime=400)
            
        else:
            if self.DEBUG:
                print("not using GPIO doorbell button")




    def really_start_camera(self):
        if self.DEBUG:
            print("in really_start_camera")
            
        try:
            stream_command = self.mediamtx_binary_path
        
            if self.persistent_data['camera_resolution'] == "Full HD (1080p)":
                if self.DEBUG:
                    print("Selecting MediaMTX Full HD streaming configuration file")
                stream_command += ' mediamtx_hd.yml' 
                
            if self.running:
                if self.DEBUG:
                    print("__")
                    print("CAMERA STREAM COMMAND")
                    print(str( stream_command ) )
            
                os.system('pkill mediamtx')
                os.system('chmod +x ' + str(self.mediamtx_binary_path))
                self.stream_process = subprocess.Popen(stream_command.split(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, cwd=self.streamer_path)
                                     #stderr=subprocess.PIPE, universal_newlines=True, preexec_fn=os.setpgrp)
            
                self.stream_process_pid = self.stream_process.pid
                if self.DEBUG:
                    print("mediamtx process PID = " + str(self.stream_process_pid))
            
                if self.stream_process_pid != None:
                    self.pi_camera_started = True
                    
        except Exception as ex:
            if self.DEBUG:
                print("Error really starting camera stream: " + str(ex))
                
        if self.DEBUG:
            print("BEYOND STREAM START")


    
    def start_thumbnail_server(self):
        print("starting webserver on port: " + str(self.thumbnail_server_port))
        
        def handler(client_soc):
            #print("in socket handler")
            
            source_image = '/tmp/homebridge_thumbnail.jpg'
            if self.persistent_data['privacy_preview']:
                source_image = self.privacy_streaming_thumbnail_path
            
            
            with open(source_image, 'rb') as thumbnail_pointer:
                #self.hb_config_data = json.load(f)
                #thumbnail_pointer = open('/tmp/homebridge_thumbnail.jpg', 'rb')
                thumbnail_data = thumbnail_pointer.read()
                thumbnail_size = len(thumbnail_data)
                #print("thumbnail size: " + str(thumbnail_size))
                
            
            http_head = "HTTP/1.1 200 OK\r\n"
            http_head += "Date:"+ time.asctime() +"GMT\r\n"
            http_head += "Expires: -1\r\n"
            http_head += "Cache-Control: max-age=0, no-cache\r\n"
            #Cache-Control: max-age=0, no-cache, must-revalidate, proxy-revalidate
            http_head += "Content-Type: image/jpg\r\n"
            http_head += "content-length: " + str(thumbnail_size) + "\r\n"
            http_head += 'Content-Disposition: inline; filename="thumbnail.jpg"\r\n'
            #header('Content-Disposition: inline; filename="July Report.pdf"');
            #http_head += "charset=utf-8\r\n"
            http_head += "\r\n"
        
            #data = "<html><head><meta charset='utf-8'/></head>"
            #data += "<body><h1>In321 is the best course ! (doubt) </h1>"
            #data += "\r\n"
            #data += "<img src=\"C:\\Users\\aliel\\OneDrive\\Documents\\GitHub\\TP2_In321\\crying_cat_with_thumb_up.jpg\" alt=\"A cr>
            #data += "</body></html>\r\n"
            #data += "\r\n"
        
            bookend = "\r\n"
        
            http_response = http_head.encode("ascii") + thumbnail_data  + bookend.encode("ascii") #.encode("utf-8")
            
            # what was sent our way?
            data = client_soc.recv(1024)
            #print("received data:", data.decode('utf-8'))
            
            if self.DEBUG:
                client_soc.send(http_response)
            else:
                # Only allow requests from localhost
                if 'Host: localhost' in data.decode('utf-8'):
                    client_soc.send(http_response)
                else:
                    client_soc.send("HTTP/1.1 403 Forbidden\r\n".encode("ascii"))
                
            client_soc.close()
            
        try:
            # on quick restarts the port might not be available yet
            if self.DEBUG:
                time.sleep(5)
            
            with socket.socket() as listening_sock:
                listening_sock.bind(('', self.thumbnail_server_port))
                listening_sock.listen()
                while self.running:
                    client_soc, client_address = listening_sock.accept()
                    threading.Thread(target=handler,args=(client_soc,), daemon=True).start()
                    #time.sleep(0.1)
                    #print("SOCKET BOOM")
                    
        except Exception as ex:
            print("Error starting thumbnail server: " + str(ex))
    
        print("end of thumbnail server thread")
        
        
        
    def thumbnail_taker(self):
        while self.running:
            time.sleep(1)
            if self.last_thumbnail_time + self.thumbnail_interval < time.time():
                self.last_thumbnail_time = time.time()
                #print("self.persistent_data['privacy_preview']: " + str(self.persistent_data['privacy_preview']))
                if self.persistent_data['streaming'] and not self.persistent_data['privacy_preview']:
                    #if self.DEBUG:
                    #    print("taking a thumbnail from the stream")
                    # alternative ffmpeg log level is warning
                    
                    thumbnail_command = 'ffmpeg -hide_banner -loglevel panic -i rtsp://localhost:' + str(self.rtsp_port) + '/pi -frames:v 1 -y /tmp/homebridge_thumbnail.jpg'
                    shell(thumbnail_command)
                    
                        
        os.system('cp ' + str(self.not_streaming_thumbnail_path) + ' /tmp/homebridge_thumbnail.jpg')
        if self.DEBUG:
            print('end of thumbnail taker thread')

    
    # button pressed on respeaker board (or test press)
    def dingdong(self):
        if self.DEBUG:
            print("\nDING DONG! doorbell button pressed. calling url: " + str(self.doorbell_url))
        try:
            # E.g. http://hostname:port/doorbell?Camera%20Name
            req = urlreq.Request(self.doorbell_url)
            req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36')
            urlreq.urlopen(req).read()
        except Exception as ex:
            print("dingdong: error calling url: " + str(ex))
        
        try:
            self.devices['homebridge-thing'].properties['doorbell'].update( True )
            time.sleep(2)
            self.devices['homebridge-thing'].properties['doorbell'].update( False )
        except Exception as ex:
            print("error setting streaming on thing: " + str(ex))
    
    
    
    # Thing: turn camera streaming on and off
    def set_streaming(self,streaming):
        try:
            print("in set_streaming with value: " + str(streaming))
        
            # saves the new state in the persistent data file, so that the addon can restore the correct state if it restarts
            if streaming != self.persistent_data['streaming']:
                self.persistent_data['streaming'] = streaming
                self.save_persistent_data() 
        
            if streaming == True:
                if self.DEBUG:
                    print("set_streaming: starting camera stream")
                self.send_pairing_prompt("Starting camera stream")
                self.start_camera()
            else:
                if self.DEBUG:
                    print("set_streaming: stopping camera stream")
                self.send_pairing_prompt("Stopping camera stream")
                self.stop_camera()
                
            try:
                self.devices['homebridge-thing'].properties['streaming'].update( self.persistent_data['streaming'] )
            except Exception as ex:
                print("error setting streaming on thing: " + str(ex))
        
        except Exception as ex:
            if self.DEBUG:
                print("error in set_streaming: " + str(ex))
            
            
    # Thing: ring the doorbell
    def test_doorbell(self,state):
        if self.DEBUG:
            print("in test_doorbell with value: " + str(state))
        self.devices['homebridge-thing'].properties['test_doorbell'].update( True )
        self.dingdong()
        time.sleep(0.1)
        self.devices['homebridge-thing'].properties['test_doorbell'].update( False )
            
            
    # Thing: set camera resolution
    def set_camera_resolution(self,resolution):
        try:
            print("in set_camera_resolution with value: " + str(resolution))
        
            # saves the new state in the persistent data file, so that the addon can restore the correct state if it restarts
            if self.persistent_data['camera_resolution'] != resolution and resolution in self.available_resolutions:
                self.persistent_data['camera_resolution'] = resolution
                self.save_persistent_data() 
            else:
                print("Error, that camera resolution is not available on the connected camera")
        
            try:
                self.devices['homebridge-thing'].properties['camera_resolution'].update( self.persistent_data['camera_resolution'] )
            except Exception as ex:
                print("error setting camera resolution on thing: " + str(ex))
        
            if self.persistent_data['camera_resolution'] != self.previous_camera_resolution:
                print("camera resolution changed. \n[1] Stopping camera.")
                self.stop_camera()
                print("[2] starting camera")
                self.start_camera()
                print("[3] restarting Homebridge")
                self.quick_hb_restart()
        
        except Exception as ex:
            print("error in set_camera_resolution: " + str(ex))
            
            
    # Thing: toggle privacy protecting preview image
    def set_privacy_preview(self,state):
        try:
            print("in set_privacy_preview with value: " + str(state))
        
            # saves the new state in the persistent data file, so that the addon can restore the correct state if it restarts
            if state != self.persistent_data['privacy_preview']:
                self.persistent_data['privacy_preview'] = state
                self.save_persistent_data() 
        
            try:
                self.devices['homebridge-thing'].properties['privacy_preview'].update( self.persistent_data['privacy_preview'] )
            except Exception as ex:
                print("error setting privacy_preview on thing: " + str(ex))
        
        except Exception as ex:
            if self.DEBUG:
                print("error in set_privacy_preview: " + str(ex))
            
            
            
    
    # INSTALL

    def install_hb(self):
        if self.busy_intalling_hb == True:
            print("Already busy installing Homebridge, aborting new install")
            return
        
        try:
            os.chdir(self.hb_path)
        
            # check if there is enough disk space
            space = shell("df -P " + str(self.user_profile['addonsDir']) + " | tail -1 | awk '{print $4}'")
            # df -P . | tail -1 | awk '{print $4}'
        
            print("Homebridge: free disk space: " + str(space))
        
            if len(space) == 0:
                print("Error running disk space check command")
                return
        
            if int(space) < 500000:
                print("Not enough free disk space for installation")
                self.hb_install_progress = -2
                self.busy_intalling_hb = False
                return
            else:
                print("Enough disk space available")
            
            
            print("Starting Homebridge installation")
            self.busy_intalling_hb == True
        
            self.hb_install_progress = 2
        
        
        
            os.system('curl -sSfL https://repo.homebridge.io/KEY.gpg | sudo gpg --dearmor | sudo tee /usr/share/keyrings/homebridge.gpg  > /dev/null')
            self.hb_install_progress = 4
        
            os.system('echo "deb [signed-by=/usr/share/keyrings/homebridge.gpg] https://repo.homebridge.io stable main" | sudo tee /etc/apt/sources.list.d/homebridge.list > /dev/null')
            self.hb_install_progress = 6
        
            os.system('sudo apt-get update')
            self.hb_install_progress = 20
        
            print("Starting Homebridge download")
        
            os.system('apt-get download homebridge')
            #p = subprocess.Popen(["apt-get","download","homebridge"], cwd=self.hb_path)
            #p.wait()
        
        
            # Check if homebridge deb file downloaded and get .deb file name, e.g. homebridge_1.0.34_arm64.deb
            deb_file_name = ""
            files = os.listdir(self.hb_path)
            if self.DEBUG:
                print("files: " + str(files))
            for file_name in files:
                if os.path.isfile(file_name):
                    if file_name.startswith("homebridge") and file_name.endswith('.deb'):
                        print("Homebridge deb file downloaded succesfully")
                        deb_file_name = file_name
                        self.hb_install_progress = 40
                        break
        
            # ALT using shell
            deb_file = shell("ls " + str(self.hb_path)).rstrip()
            print("deb_file: " + str(deb_file))
            
            if deb_file_name == "":
                print("Error, Homebridge deb file failed to download")
                self.hb_install_progress = -40
                self.busy_intalling_hb = False
                return
        
            print("Extracting tar files")
            os.system("ar x " + str(deb_file_name))
        
            os.system("rm " + str(deb_file_name))
        
            os.system("tar xf control.tar.xz")
            os.system("rm control.tar.xz")
            self.hb_install_progress = 60
            print("control.tar.xz done")
        
            os.system("tar xf data.tar.xz")
            os.system("rm data.tar.xz")
            
            # Clean up other remaining files
            os.system("rm conffiles")
            os.system("rm control")
            os.system("rm debian-binary")
            os.system("rm md5sums")
            os.system("rm preinst")
            os.system("rm prerm")
            os.system("rm postinst")
            os.system("rm postrm")
            
            # TODO: remove usr and lib directories too, but that's a bit risky without an absolute path
            
            self.hb_install_progress = 80
            print("data.tar.xz done")

            # Check if homebridge is fully installed
            if os.path.isfile(self.hb_service_path):
                print("Homebridge installed succesfully")

                print("Installing homebridge-webthings Node module")
                p = subprocess.Popen([self.hb_npm_path,"install","--save","git+https://github.com/createcandle/homebridge-webthings.git"], cwd=self.hb_plugins_path)
                p.wait()
        
                if os.path.isdir(self.hb_webthings_plugin_path):
                    self.update_installed_plugins_list()
                
                    self.hb_installed = True
                    self.hb_install_progress = 100
                    
                    # now start Homebridge
                    self.run_hb()
                    
                else:
                    self.hb_install_progress = -80
                
            else:
                print("Homebridge failed to fully install")
                self.hb_install_progress = -100
            
        except Exception as ex:
            print("Error in intall_hb: " + str(ex))
        

        self.busy_intalling_hb = False




    # CONFIG FILE

    def update_config_file(self,reset=False):
        
        made_modifications = False
        
        if os.path.isfile(self.hb_config_file_path):
            
            try:
                with open(self.hb_config_file_path) as f:
                    self.hb_config_data = json.load(f)
                    if self.DEBUG:
                        print('Homebridge config was loaded from file: ' + str(self.hb_config_file_path))
                        #print("self.hb_config_data: " + str(self.hb_config_data))
                    
                    if not "bridge" in self.hb_config_data:
                        if self.DEBUG:
                            print('ERROR, config data did not have bridge object.')
                        return
                
                    #self.setup_id = self.hb_config_data["bridge"]["name"][-4:]
                    #if self.DEBUG:
                    #    print("SETUP ID: " + str(self.setup_id))
                    
                    try:
                        
                        # If this is part of a reset, change the main username to something else
                        if reset:
                            alphabet="0123456789ABCDEF"
                            r = random.SystemRandom()
                            self.hb_config_data["bridge"]["username"] = ':'.join(r.choice(alphabet)+r.choice(alphabet) for x in range(6))
                            made_modifications = True
                        
                        # make the bridge name start with Candle
                        if not "Candle" in self.hb_config_data["bridge"]["name"]:
                            self.hb_config_data["bridge"]["name"] = "Candle " + str(self.hb_config_data["bridge"]["name"])
                            made_modifications = True
                    
                        # add camera settings to config file
                        if os.path.isdir(self.hb_camera_plugin_path):
                            camera_config_exists = False
                            if 'platforms' in self.hb_config_data:
                                #for key, pl in self.hb_config_data['platforms'].items():
                                #for pl in self.hb_config_data['platforms']:
                                for i in range(len( self.hb_config_data['platforms'] )):
                                    if self.hb_config_data['platforms'][i]['name'] == 'Camera FFmpeg':
                                        if self.DEBUG:
                                            print("a Camera FFmpeg config is already present in config file")
                                        camera_config_exists = True
                                        
                                        try:
                                            if self.persistent_data['camera_resolution'] == 'Recommended (480p)':
                                                if self.DEBUG:
                                                    print("update_config_file: setting Homebridge ffmpeg plugin camera resolution to 640")
                                                self.hb_config_data['platforms'][i]['cameras'][0]['videoConfig']['maxWidth'] = 640
                                                self.hb_config_data['platforms'][i]['cameras'][0]['videoConfig']['maxHeight'] = 480
                                                self.hb_config_data['platforms'][i]['cameras'][0]['videoConfig']['maxFPS'] = 10
                                            
                                            elif self.persistent_data['camera_resolution'] == 'Full HD (1080p)':
                                                if self.DEBUG:
                                                    print("update_config_file: setting Homebridge ffmpeg plugin camera resolution to 1920")
                                                self.hb_config_data['platforms'][i]['cameras'][0]['videoConfig']['maxWidth'] = 1920
                                                self.hb_config_data['platforms'][i]['cameras'][0]['videoConfig']['maxHeight'] = 1080
                                                self.hb_config_data['platforms'][i]['cameras'][0]['videoConfig']['maxFPS'] = 4
                                                
                                                #self.camera_config['cameras'][0]['videoConfig']['maxWidth'] = 1920
                                                #self.camera_config['cameras'][0]['videoConfig']['maxHeight'] = 1080
                                                #self.camera_config['cameras'][0]['videoConfig']['maxFPS'] = 4
                                        
                                        
                                            # should the camera be separated from the other devices? This speeds up everything, but requires a separate pairing process
                                            self.hb_config_data['platforms'][i]['cameras'][0]['unbridge'] = self.unbridge_camera
                                        
                                            self.hb_config_data['platforms'][i]['cameras'][0]['videoConfig']['debug'] = self.DEBUG
                                            # Should there be /should if be possible to ring the doorbell (via http request)?
                                            #self.hb_config_data['platforms'][i]['cameras'][0]['doorbell'] = self.use_doorbell_button # is now always true
                                        except Exception as ex:
                                            if self.DEBUG:
                                                print("Error modifying camera settings in config file: " + str(ex))
                                        
                                        break
                            
                                # add the config if there is none
                                if camera_config_exists == False:
                                    if self.DEBUG:
                                        print("adding Camera FFmpeg config to config file")
                                    self.hb_config_data['platforms'].append(self.camera_config)
                                    made_modifications = True
                                    
                    except Exception as ex:
                        if self.DEBUG:
                            print("Error modifying basics in config file: " + str(ex))
                    
                    
                    # Add accessories to config file
                    try:
                        old_webthings_accessory_indexes = []
                        for index,accessory in enumerate(self.hb_config_data["accessories"]):
                            #if self.DEBUG:
                            #    print("adding to config file: accessory #" + str(index))
                                #print(json.dumps(accessory, indent=4, sort_keys=True))
                            if accessory['accessory'] == 'webthings':
                                #print("adding old index to remove later: " + str(index))
                                old_webthings_accessory_indexes.append(index)
                    
                        # Remove config (sort them from high to low to make the array popping work without issue)
                        old_webthings_accessory_indexes.sort(reverse=True)
                        #if self.DEBUG:
                        #    print("sorted old_webthings_accessory_indexes: " + str(old_webthings_accessory_indexes))
                        for old_ac_index in old_webthings_accessory_indexes:
                            #print("old_ac_index: " + str(old_ac_index))
                            self.hb_config_data["accessories"].pop(old_ac_index)
                        
                        #print("cleaned up self.hb_config_data: " + str(self.hb_config_data))
                    
                        # Recreate config
                        for ac in self.persistent_data['things']:
                            #print("ac: ")
                            #print(json.dumps(ac, indent=4))
                        
                            new_ac = {
                                    "name": ac['thing_title'],
                                    "type": ac['accessory_data']['homekit_type'],
                                    "manufacturer": "Candle",
                                    "accessory": "webthings",
                                    "topics": {},
                                    "username": "",
                                    "password": self.persistent_data['token'],
                                    "thing_id": ac['thing_id']
                                    }
                        
                            for service in ac['accessory_data']['services']:
                                #print("service: " + str(service))
                                new_ac['topics'][ service['config_name'] ] = service['thing_id'] + "/" + service['property_id']
                                
                            for extra in ac['accessory_data']['extras']:
                                for k, v in extra.items():
                                    #if self.DEBUG:
                                    #    print("setting extra: " + str(k) + " -> " + str(v))
                                    new_ac[k] = v
                        
                            #print("new_ac: " + str(new_ac))
                            self.hb_config_data["accessories"].append(new_ac)
                            made_modifications = True
                    
                        if self.DEBUG:
                            
                            #print("UPDATED HOMEBRIDGE CONFIG DATA:")
                            #print(json.dumps(self.hb_config_data, indent=4))
                            pass
                            
                            #thing_still_shared = False
                            #for ac in self.persistent_data['things']:
                            #    if self.DEBUG:
                            #        print("run_hb: AC to modify or add: " + str(ac))
                                    #print( str(self.persistent_data['things'][thing] ))
                
                    except Exception as ex:
                        if self.DEBUG:
                            print("Error modifying accessories in config file: " + str(ex))
                    
                if made_modifications is True:
                    if self.DEBUG:
                        print("Saving modified config file")
                    try:
                       json.dump( self.hb_config_data, open( self.hb_config_file_path, 'w+' ), indent=4)    
                    except Exception as ex:
                        if self.DEBUG:
                            print("Error saving modified config file: " + str(ex) )
            
            except Exception as ex:
                if self.DEBUG:
                    print("Error, could not load or parse config file: " + str(ex))


    def run_hb(self):
        if self.DEBUG:
            print("IN RUN_HB")
            
        # Just in case it's already running, stop it first
        self.stop_hb()
            
        if not os.path.isdir(self.hb_webthings_plugin_path):
            print("Error, the Homebridge-webthings module seems to be missing")
            self.send_pairing_prompt( "Error, Homebridge Webthings module is missing" )
            self.hb_installed = False
            
            # Check if homebridge is fully installed
            if os.path.isfile(self.hb_service_path):
                print("Homebridge installed succesfully")

                print("run_hb: fixing missing homebridge-webthings Node module")
                p = subprocess.Popen([self.hb_npm_path,"install","--save","git+https://github.com/createcandle/homebridge-webthings.git"], cwd=self.hb_plugins_path)
                p.wait()
        
                if os.path.isdir(self.hb_webthings_plugin_path):
                    self.update_installed_plugins_list()
                
                    self.hb_installed = True
                    self.hb_install_progress = 100
                else:
                    self.hb_install_progress = -80
                
            else:
                print("Homebridge failed to fully install")
                self.hb_install_progress = -100
            
        self.update_config_file()
        
        if self.DEBUG:
            print("starting the homebridge process")
        try:
            self.really_run_hb()
            #self.hb_thread = threading.Thread(target=self.really_run_hb)
            #self.hb_thread.daemon = True
            #self.hb_thread.start()
            #time.sleep(1)
            #print("HB Thread.is_alive() one second after starting?: " + str(self.hb_thread.is_alive()))
        except:
            if self.DEBUG:
                print("Error starting the homebridge process")






    def really_run_hb(self):
        if self.DEBUG:
            print("in really_run_hb")

        try:
            
            if not os.path.isfile(self.hb_service_path):
                print("Error, Homebridge not installed properly? Aborting.")
                return            

            # exec /home/pi/.webthings/hb/opt/homebridge/bin/node /home/pi/.webthings/hb/opt/homebridge/lib/node_modules/homebridge-config-ui-x/dist/bin/hb-service.js run -I -U /home/pi/.webthings/hb/var/lib/homebridge -P /home/pi/.webthings/hb/var/lib/homebridge/node_modules --strict-plugin-resolution "$@"

            hb_command = ""
            hb_command += str(self.hb_node_path)  # could potentially skip this if the node versions are equal
            hb_command += " " + str(self.hb_service_path)
            hb_command += " run -I" # insecure mode
            #if self.DEBUG:
            hb_command += " -D" # debug mode
            hb_command += " -U " + str(self.hb_storage_path)
            hb_command += " -P " + str(self.hb_plugins_path)
            #hb_command += " --strict-plugin-resolution" #--stdout
        
            #while self.running:
            if self.running:
                if self.DEBUG:
                    print("__")
                    print("HOMEBRIDGE COMMAND")
                    print(str( hb_command ))
            
                self.hb_process = subprocess.Popen(hb_command.split(), stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
                                     #stderr=subprocess.PIPE, universal_newlines=True, preexec_fn=os.setpgrp)
            
                self.hb_process_pid = self.hb_process.pid
                if self.DEBUG:
                    print("hb process PID = " + str(self.hb_process_pid))
            
                if self.hb_process_pid != None:
                    self.launched = True
            
        except Exception as ex:
            print("Error really starting Homebridge: " + str(ex))
        
            """
            while self.running:
                
                # Read both stdout and stderr simultaneously
                sel = selectors.DefaultSelector()
                sel.register(self.hb_process.stdout, selectors.EVENT_READ)
                sel.register(self.hb_process.stderr, selectors.EVENT_READ)
                
                for key, val1 in sel.select():
                    line = key.fileobj.readline()
                    if not line:
                        #pass
                        #break
                        continue
                    if key.fileobj is self.hb_process.stdout:
                        #if self.DEBUG:
                        #print(f"STDOUT: {line}", end="", file=sys.stdout)
                        self.parse_hb(f"{line}")
                    else:
                        #print(f"STDERR: {line}", end="", file=sys.stderr)
                        self.parse_hb(f"{line}")
                time.sleep(0.1)
            """
                
        if self.DEBUG:
            print("BEYOND HOMEBRIDGE LOOP")

    # not used anymore in favour of reading the log file instead
    def parse_hb(self,line):
        if self.DEBUG:
            print("parse_hb got line: " + str(line))
        if line.startswith('X-HM:'):
            self.qr_code_url = str(line).rstrip()
            if self.DEBUG:
                print("spotted QR code url: " + str(self.qr_code_url))


    def quick_hb_restart(self):
        if self.DEBUG:
            print("doing a quick hb restart")
        self.update_config_file()
        os.system('pkill homebridge')


    def stop_hb(self):
        if self.DEBUG:
            print("in stop_hb")
            
        if self.hb_process != None:
            self.hb_process.terminate()
            if self.DEBUG:
                print("hopefully the HB process closed cleanly")
            time.sleep(1)
        if self.hb_process_pid != None:
            shell("sudo kill {}".format(self.hb_process_pid))
            self.hb_process_pid = None
            time.sleep(4)
        
        os.system('pkill hb-service;pkill homebridge')
        time.sleep(1)
        
        self.launched = False
        
        if self.hb_thread != None:
            if self.DEBUG:
                print("Warning! Homebridge thread still existed! is it alive?: " + str(self.hb_thread.is_alive()))
            #try:
            #    self.hb_thread.terminate()
            #except Exception as ex:
            #    print("Error terminating thread: " + str(ex))
            if self.hb_thread.is_alive():
                if self.DEBUG:
                    print("Warning! Homebridge thread was still alive, giving it 2 more seconds to stop cleanly")
                time.sleep(2)
        
        self.hb_thread = None
        self.hb_process = None


    # like a factory reset
    def reset_hb(self):
        try:
            self.save_persistent_data()

            self.stop_hb()
            
            os.system('rm -rf ' + str(os.path.join(self.hb_storage_path, "accessories") ))
            os.system('rm -rf ' + str(os.path.join(self.hb_storage_path, "persist") ))
            os.system('rm -rf ' + str(os.path.join(self.hb_storage_path, "backups") ))
            #os.system('rm ' + str(os.path.join(self.hb_storage_path, "config.json") ))
            os.system('rm ' + str(os.path.join(self.hb_storage_path, "homebridge.log") ))
            # Not deleting the auth file so the user can still easily log into the Homebridge UI
            
            self.update_config_file(reset=True)
            
            time.sleep(1)
            
            self.start_hb()
            
            return True
            
        except Exception as ex:
            print("Error in reset_hb: " + str(ex))

        return False
        
        
        
    def update_installed_plugins_list(self):
        if self.DEBUG:
            print("in update_installed_plugins_list")
        self.plugins_list = []
        if os.path.isdir(self.hb_plugins_path):
            files = os.listdir(self.hb_plugins_path)
            if self.DEBUG:
                print("plugin directories in node_modules: " + str(files))
            for file_name in files:
                print(str(file_name))
                file_path = os.path.join(self.hb_plugins_path,file_name)
                if os.path.isdir(file_path):
                    if self.DEBUG:
                        print("is dir: " + str(file_path))
                    if file_name.startswith(".") or file_name == 'homebridge':
                        if self.DEBUG:
                            print("update_installed_plugins_list: spotted hidden file or the homebridge node module, skipping")
                        continue
                    
                    #dir_size = os.path.getsize(file_path)
                    #if self.DEBUG:
                    #    print("dir_size:",dir_size)
                    
                    #if file_name.startswith("homebridge") and file_name.endswith('.deb'):
                    self.plugins_list.append({'name':file_name,'value':1})

        if self.DEBUG:
            print("self.plugins_list: " + str(self.plugins_list))






        

    #
    # The methods below are called by the controller
    #

    def start_pairing(self, timeout):
        """
        Start the pairing process. This starts when the user presses the + button on the things page.
        
        timeout -- Timeout in seconds at which to quit pairing
        """
        print("in start_pairing. Timeout: " + str(timeout))
        
        
    def cancel_pairing(self):
        """ Happens when the user cancels the pairing process."""
        # This happens when the user cancels the pairing process, or if it times out.
        print("in cancel_pairing")
        
        
    def remove_thing(self, device_id):
        print("user deleted the thing")
        try:
            # We don't have to delete the thing in the addon, but we can.
            obj = self.get_device(device_id)
            self.handle_device_removed(obj) # Remove from device dictionary
            if self.DEBUG:
                print("User removed thing")
        except:
            print("Could not remove thing from devices")
                

    def unload(self):
        if self.DEBUG:
            print("Bye!")
            
        self.running = False
            
        try:
            #self.devices['homebridge-thing'].properties['status'].update( "Bye")
            # Tell the controller to show the device as disconnected. This isn't really necessary, as the controller will do this automatically.
            #self.devices['homebridge-thing'].connected_notify(False)
        
            os.system('cp ' + str(self.not_streaming_thumbnail_path) + ' /tmp/homebridge_thumbnail.jpg')
            # A final chance to save the data.
            self.save_persistent_data()

            # Make sure the camera is no longer streaming
            os.system('pkill mediamtx')
            # stop_camera() is much slower, so doing the quick and dirty method here instead
            
            
            if self.hb_process_pid != None:
                shell("sudo kill {}".format(self.hb_process_pid))
        
            time.sleep(1)
            os.system('pkill hb-service; pkill homebridge')
            
        except Exception as ex:
            print("Error setting status on thing: " + str(ex))
        
        
    

    #
    # This saves the persistent_data dictionary to a file
    #
    
    def save_persistent_data(self):
        if self.DEBUG:
            print("Saving to persistence data store")

        try:
            if not os.path.isfile(self.persistence_file_path):
                open(self.persistence_file_path, 'a').close()
                if self.DEBUG:
                    print("Created an empty persistence file")
            else:
                if self.DEBUG:
                    print("Persistence file existed. Will try to save to it.")

            try:
                json.dump( self.persistent_data, open( self.persistence_file_path, 'w+' ) , indent=4)
                return True
            except Exception as ex:
                print("Error saving to persistence file: " + str(ex))

            #with open(self.persistence_file_path) as f:
            #    if self.DEBUG:
            #        print("saving: " + str(self.persistent_data))
                
            #    return True
            #self.previous_persistent_data = self.persistent_data.copy()

        except Exception as ex:
            if self.DEBUG:
                print("Error: could not store data in persistent store: " + str(ex) )
        
        return False













def get_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except:
        IP = None
    finally:
        s.close()
    return IP



def shell(command):
    #print("HOTSPOT SHELL COMMAND = " + str(command))
    shell_check = ""
    try:
        shell_check = subprocess.check_output(command, shell=True)
        shell_check = shell_check.decode("utf-8")
        shell_check = shell_check.strip()
    except:
        pass
    return shell_check 
        

# not used?
def kill(command):
    check = ""
    try:
        search_command = "ps ax | grep \"" + command + "\" | grep -v grep"
        #print("hotspot: in kill, search_command = " + str(search_command))
        check = shell(search_command)
        #print("hotspot: check: " + str(check))

        if check != "":
            #print("hotspot: Process was already running. Cleaning it up.")

            old_pid = check.split(" ")[0]
            #print("- hotspot: old PID: " + str(old_pid))
            if old_pid != None:
                os.system("sudo kill " + old_pid)
                #print("- hotspot: old process has been asked to stop")
                time.sleep(1)
        
    except Exception as ex:
        pass