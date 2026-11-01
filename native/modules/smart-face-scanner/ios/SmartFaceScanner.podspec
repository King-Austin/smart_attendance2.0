Pod::Spec.new do |s|
  s.name = 'SmartFaceScanner'
  s.version = '1.0.0'
  s.summary = 'Native MediaPipe face scanner for Smart Campus Presence'
  s.description = 'Native front camera, face landmarks, blendshapes and capture for attendance liveness.'
  s.author = 'Smart Campus Presence'
  s.homepage = 'https://github.com/King-Austin/smart_attendance2.0'
  s.license = { :type => 'MIT' }
  s.platforms = { :ios => '15.1' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.dependency 'MediaPipeTasksVision', '0.10.32'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.resource_bundles = { 'SmartFaceScanner' => ['face_landmarker.task'] }
  s.swift_version = '5.9'
end
