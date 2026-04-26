//
//  BarcodePlugin.m
//  App
//
//  Objective-C bridge required by Capacitor to register the Swift plugin.
//

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(BarcodePlugin, "BarcodePlugin",
    CAP_PLUGIN_METHOD(scan, CAPPluginReturnPromise);
)
