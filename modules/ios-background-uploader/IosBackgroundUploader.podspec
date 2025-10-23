Pod::Spec.new do |s|
  s.name           = 'IosBackgroundUploader'
  s.version        = '0.1.0'
  s.summary        = 'iOS native background file uploader using URLSession'
  s.description    = 'A React Native module for iOS background file uploads using URLSession with multipart/form-data support'
  s.author         = { 'name' => 'Pouch It' }
  s.homepage       = 'https://github.com/your-repo/pouch-it-poc2'
  s.platform       = :ios, '15.1'
  s.source         = { :path => '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift source files
  s.source_files = 'ios/**/*.{swift}'

  # TypeScript/JavaScript source files (for RN bridge)
  s.source_files = 'lib/**/*.{js,jsx,ts,tsx}'
end
