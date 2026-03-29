#import <Capacitor/Capacitor.h>

CAP_PLUGIN(BarcodePlugin, "BarcodePlugin",
    CAP_PLUGIN_METHOD(scan, CAPPluginReturnPromise);
)
