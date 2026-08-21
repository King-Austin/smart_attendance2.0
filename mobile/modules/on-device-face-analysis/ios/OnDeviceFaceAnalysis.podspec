Pod::Spec.new do |s|
  s.name           = 'OnDeviceFaceAnalysis'
  s.version        = '1.0.0'
  s.summary        = 'On-device face and liveness frame analysis'
  s.description    = 'Runs Google ML Kit face detection locally for Smart Campus Presence.'
  s.author         = 'King Austin'
  s.homepage       = 'https://github.com/King-Austin/smart_attendance2.0'
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'GoogleMLKit/FaceDetection', '8.0.0'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
