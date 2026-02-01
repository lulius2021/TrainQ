//
//  TrainQWidgetBundle.swift
//  TrainQWidget
//
//  Created by Julius on 31.01.26.
//

import WidgetKit
import SwiftUI

@main
struct TrainQWidgetBundle: WidgetBundle {
    var body: some Widget {
        TrainQWidget()
        TrainQWidgetControl()
        TrainQWidgetLiveActivity()
    }
}
