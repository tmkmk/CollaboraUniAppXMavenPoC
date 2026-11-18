# Configure only the disposable SDK probe target, not the user's app.
require 'xcodeproj'
root = File.expand_path('~/collabora-build/ios-sdk-host/HBuilder-Hello')
project = Xcodeproj::Project.open(File.join(root, 'HBuilder-Hello.xcodeproj'))
target = project.targets.find { |item| item.name == 'HBuilder' }
raise 'HBuilder target missing' unless target
target.build_configurations.each do |config|
  settings = config.build_settings
  settings.keys.each do |key|
    settings.delete(key) if key.match?(/\A(DEVELOPMENT_TEAM|CODE_SIGN_IDENTITY|PROVISIONING_PROFILE|PROVISIONING_PROFILE_SPECIFIER)(\[|\z)/)
  end
  settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'iso.app.UNIC1D9BB6'
  settings['DEVELOPMENT_TEAM'] = '8WR2458DLP'
  settings['CODE_SIGN_STYLE'] = 'Manual'
  settings['CODE_SIGN_IDENTITY'] = config.name == 'Debug' ? 'iPhone Developer' : 'iPhone Distribution'
  settings['PROVISIONING_PROFILE_SPECIFIER'] = config.name == 'Debug' ? 'Xiang' : 'XiangBuild'
end
project.save
puts 'Configured isolated host signing; business AppKey/resources are not configured.'
