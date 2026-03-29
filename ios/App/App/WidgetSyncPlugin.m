//
//  WidgetSyncPlugin.m
//  App
//
//  Objective-C bridge required by Capacitor to register the Swift plugin.
//

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(WidgetSyncPlugin, "WidgetSync",
    CAP_PLUGIN_METHOD(syncData, CAPPluginReturnPromise);
)
