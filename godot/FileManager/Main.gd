extends Node


var window
var end_of_manage_file_func = JavaScript.create_callback(self, 'end_of_manage_file')

var manage_stack:= []


func _ready():
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window');
		window.end_of_manage_file = end_of_manage_file_func


# 다음 파일 정보 검토하기
func check_next_stack():
	pass


func end_of_manage_file(args):
	print_debug('파일 관리 조욜: 여기서 스택 검토하여 끄던가 말던가 하기')
	window.self_destroy()
	get_tree().quit()
