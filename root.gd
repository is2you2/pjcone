extends Node


# 이 색깔로 로그 발생시 오류로 처리
const LOG_ERR:= 'faa'
# 이번 부팅의 로그 기록
var rich_log:= 'Logging Ready'
# csv 분할자
const SEP_CHAR:= '，'
# 데이터베이스 폴더 경로 with '/'
var root_path:String
# 웹 페이지 경로 with '/'
var html_path:String


# 로그처리
func logging(header:String, content:String, _con_col:= 'bbb'):
	var time:= OS.get_datetime()
	var stamp:= '[%04d-%02d-%02d %02d:%02d:%02d] ' % [
		time['year'],
		time['month'],
		time['day'],
		time['hour'],
		time['minute'],
		time['second'],
	] # 로그 생성
	var result:= '%s%s | %s' % [
		stamp, header, content
	]
	if _con_col == LOG_ERR:
		printerr(result)
	else: # 일반 로그
		print(result)
	# 로그 노드가 있으면 추가하기
	if rich_log != null:
		var result_gui:= '%s[color=#%s]%s[/color] | %s' % [
			stamp, header, _con_col, content
		]
		rich_log += '\n' + result_gui
