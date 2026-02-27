-- Test what the module actually exports
local module = require(game:GetService("ReplicatedStorage").TS.Modules.ExamplePlayerService)
print("Module type:", typeof(module))
print("Module:", module)
print("Module.default type:", typeof(module.default))
print("Module.default:", module.default)
if module.default then
    print("Module.default.new type:", typeof(module.default.new))
end
