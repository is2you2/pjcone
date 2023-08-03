extends Node


var window


func _process(delta):
	print('동작로그: ', OS.get_ticks_msec())


func end_of_manage_file():
	print_debug('파일 관리 조욜')
