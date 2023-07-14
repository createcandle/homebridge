from gateway_addon import Device, Property


class HomebridgeDevice(Device):
    """Homebridge device type."""

    def __init__(self, adapter):
        """
        Initialize the object.
        adapter -- the Adapter managing this device
        """

        Device.__init__(self, adapter, 'homebridge')

        self._id = 'homebridge-thing' # TODO: probably only need the first of these
        self.id = 'homebridge-thing'
        self.adapter = adapter
        self.DEBUG = adapter.DEBUG

        self.name = 'Homebridge camera' # TODO: is this still used? hasn't this been replaced by title?
        self.title = 'Homebridge camera'
        self.description = 'The Homebridge thing, which has camera a streaming setting'
        
        # We give this device an optional "capability". This will cause it to have a nicer icon that indicates what it can do. 
        # Capabilities are always a combination of giving a this a capability type, and giving at least one of its properties a capability type.
        # For example, here the device is a "multi level switch", which means it should have a boolean toggle property as well as a numeric value property
        # There are a lot of capabilities, read about them here: https://webthings.io/schemas/
        
        self._type = ["OnOffSwitch","PushButton"] 
        # 'MultiLevelSwitch' # a combination of a toggle switch and a numeric value


        try:
            
            # if there is at least one resolution available
            if len(self.adapter.available_resolutions) > 0:
                
                
                self.properties["streaming"] = HomebridgeProperty(
                                self,
                                "streaming",
                                {
                                    '@type': 'OnOffProperty', # by giving the property this "capability", it will create a special icon indicating what it can do. Note that it's a string (while on the device it's an array).
                                    'title': "Camera",
                                    'readOnly': False,
                                    'type': 'boolean'
                                },
                                self.adapter.persistent_data['streaming']) # we give the new property the value that was remembered in the persistent data store
                
                
                
                
                if self.DEBUG:
                    print("Adding resolution switcher property to thing")
                    
                # make sure the selected resolution is possible with the currently attached camera
                if not self.adapter.persistent_data['camera_resolution'] in self.adapter.available_resolutions:
                    self.adapter.persistent_data['camera_resolution'] = self.adapter.available_resolutions[0]
                    
                self.properties["camera_resolution"] = HomebridgeProperty(
                            self,
                            "camera_resolution",
                            {
                                'title': "Camera resolution",
                                'type': 'string',
                                'readOnly': False,
                                'enum': self.adapter.available_resolutions,
                            },
                            self.adapter.persistent_data['camera_resolution']) 
            
            
            
            else:
                if self.DEBUG:
                    print("Warning, not adding resolution switcher property to Homebridge device. self.adapter.available_resolutions: " + str(self.adapter.available_resolutions))
            
            
            
            
            if self.adapter.use_doorbell_button:
                self.properties["doorbell"] = HomebridgeProperty(
                                self,
                                "doorbell",
                                {
                                    '@type': 'PushedProperty', # by giving the property this "capability", it will create a special icon indicating what it can do. Note that it's a string (while on the device it's an array).
                                    'title': "Doorbell",
                                    'readOnly': False,
                                    'type': 'boolean'
                                },
                                False)
            
            
                self.properties["test_doorbell"] = HomebridgeProperty(
                                self,
                                "test_doorbell",
                                {
                                    'title': "Test doorbell",
                                    'readOnly': False,
                                    'type': 'boolean'
                                },
                                False) # we give the new property the value that was remembered in the persistent data store
                
            
            
            """
            # Creates a percentage slider
            self.properties["slider"] = HomebridgeProperty( # (here "slider" is just a random name)
                            self,
                            "slider",
                            {
                                '@type': 'LevelProperty', # by giving the property this "capability", it will create a special icon indicating what it can do.
                                'title': "Slider example",
                                'type': 'integer',
                                'readOnly': False,
                                'minimum': 0,
                                'maximum': 100,
                                'unit': 'percent'
                            },
                            self.adapter.persistent_data['slider'])
                        
                        
            # This property shows a simple string in the interface. The user cannot change this string in the UI, it's "read-only" 
            self.properties["status"] = HomebridgeProperty(
                            self,
                            "status",
                            {
                                'title': "Status",
                                'type': 'string',
                                'readOnly': True
                            },
                            "Hello world")

            """
            
            
        except Exception as ex:
            if self.DEBUG:
                print("error adding properties to thing: " + str(ex))

        if self.DEBUG:
            print("thing has been created.")



class HomebridgeProperty(Property):

    def __init__(self, device, name, description, value):
        # This creates the initial property
        
        # properties have:
        # - a unique id
        # - a human-readable title
        # value. The current value of this property
        
        Property.__init__(self, device, name, description)
        
        self.device = device # a way to easily access the parent device, of which this property is a child.
        self.DEBUG = device.DEBUG
        
        self.id = name
        self.name = name # TODO: is name still used?
        self.title = name # TODO: the title isn't really being set?
        self.description = description # a dictionary that holds the details about the property type
        self.value = value # the value of the property
        
        # Notifies the controller that this property has a (initial) value
        self.set_cached_value(value)
        self.device.notify_property_changed(self)
        
        if self.DEBUG:
            print("property: initiated: " + str(self.title) + ", with value: " + str(value))


    def set_value(self, value):
        # This gets called by the controller whenever the user changes the value inside the interface. For example if they press a button, or use a slider.
        if self.DEBUG:
            print("property: set_value called for " + str(self.title))
            print("property: set value to: " + str(value))
        
        try:
            
            # Depending on which property this is, you could have it do something. That method could be anywhere, but in general it's clean to keep the methods at a higher level (the adapter)
            # This means that in this example the route the data takes is as follows: 
            # 1. User changes the property in the interface
            # 2. Controller calls set_value on property
            # 3. In this example the property routes the intended value to a method on the adapter (e.g. set_state). See below.
            # 4. The method on the adapter then does whatever it needs to do, and finally tells the property's update method so that the new value is updated, and the controller is sent a return message that the value has indeed been changed.
            
            #  If you wanted to you could simplify this by calling update directly. E.g.:
            # self.update(value)
            
            if self.id == 'streaming':
                self.device.adapter.set_streaming(bool(value))
            
            elif self.id == 'test_doorbell':
                self.device.adapter.test_doorbell(bool(value))
                
            elif self.id == 'camera_resolution':
                self.device.adapter.set_camera_resolution(str(value))
        
            # The controller is waiting 60 seconds for a response from the addon that the new value is indeed set. If "notify_property_changed" isn't used before then, the controller will revert the value in the interface back to what it was.
            
        
        except Exception as ex:
            if self.DEBUG:
                print("property: set_value error: " + str(ex))


    def update(self, value):
        # This is a quick way to set the value of this property. It checks that the value is indeed new, and then notifies the controller that the value was changed.
        
        if self.DEBUG:
            print("property update: " + str(self.title) + ", value: " + str(value))
         
        if value != self.value:
            self.value = value
            self.set_cached_value(value)
            self.device.notify_property_changed(self)



