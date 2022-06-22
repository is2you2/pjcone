extends Node


# 이 색깔로 로그 발생시 오류로 처리
const LOG_ERR:= 'faa'
# 로그 노드
var log_node:RichTextLabel

# 로그처리
func log(header:String, content:String, _con_col:= 'bbb'):
	var time:= OS.get_datetime()
	var stamp:= '[%04d-%02d-%02d %02d:%02d:%02d] ' % [
		time['year'],
		time['month'],
		time['day'],
		time['hour'],
		time['minute'],
		time['second'],
	] # 로그 생성
	var result:= '%s%s| %s' % [
		stamp, header, content
	]
	if _con_col == LOG_ERR:
		printerr(result)
	else: # 일반 로그
		print(result)
	# 로그 노드가 있으면 추가하기
	if log_node != null:
		var result_gui:= '%s[color=#%s]%s[/color]| %s' % [
			stamp, header, _con_col, content
		]
		log_node.bbcode_text += '\n' + result_gui