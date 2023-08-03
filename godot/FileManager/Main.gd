extends Node


var window
var end_of_manage_file_func = JavaScript.create_callback(self, 'end_of_manage_file')
var check_file_partsize_info_func = JavaScript.create_callback(self, 'check_file_partsize_info')
var req_file_part_func = JavaScript.create_callback(self, 'req_file_part')


func _ready():
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window');
		window.end_of_manage_file = end_of_manage_file_func
		window.check_file_partsize_info = check_file_partsize_info_func
		window.req_file_part = req_file_part_func

# 파일 전체 길이 및 파트 크기 정보 반환
# args[0]: path
func check_file_partsize_info(args):
	var file:= File.new()
	var err:= file.open('user://%s' % args[0], File.READ)
	var result:int
	if err == OK:
		result = file.get_len()
	else: printerr('check_file_partsize_info_open_failed: ', err,': ', args[0])
	file.close()
	window.get_partsize(args[0], result)


# 파일 파트 받기
# args[0]: path, [1]: index, [2]: full_len
func req_file_part(args):
	var file:= File.new()
	var base64:String
	var err:= file.open('user://%s' % args[0], File.READ)
	if err == OK:
		file.seek(120000 * args[1])
		var size:= 120000 if 120000 * (args[1] + 1) < args[2] else args[2] - 120000 * (args[1] - 1)
		var buf:= file.get_buffer(size)
		base64 = Marshalls.raw_to_base64(buf)
	file.close()
	window.get_part_data(args[0], base64)
