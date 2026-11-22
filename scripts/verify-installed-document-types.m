#import <AppKit/AppKit.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        if (argc != 2) return 2;
        NSString *path = [[NSString stringWithUTF8String:argv[1]] stringByResolvingSymlinksInPath];
        NSBundle *app = [NSBundle bundleWithPath:path];
        if (![[app objectForInfoDictionaryKey:@"CFBundleShortVersionString"] isEqual:@"0.17.34"]) return 2;
        for (NSString *ext in @[@"stpkg", @"stpl", @"stcw", @"stad"]) {
            UTType *type = [UTType typeWithFilenameExtension:ext];
            NSString *expected = [@"com.kouisk.sportaglytics." stringByAppendingString:ext];
            if (![type.identifier isEqual:expected]) {
                NSLog(@"Unexpected registered document type for %@: %@", ext, type);
                return 1;
            }
            NSArray<NSURL *> *handlers = [NSWorkspace.sharedWorkspace URLsForApplicationsToOpenContentType:type];
            BOOL found = NO;
            for (NSURL *handler in handlers) {
                if ([handler.path.stringByResolvingSymlinksInPath isEqual:path]) found = YES;
            }
            if (!found) {
                NSLog(@"Installed release not listed as a handler for %@", ext);
                return 1;
            }
            NSLog(@"Installed release is a registered handler for %@", type.identifier);
        }
    }
    return 0;
}
