extends Control
# 폴더를 올려 내부 파일 리스트를 json으로 돌려줍니다.
# Starcraft-custom 에서 이미지 리스트를 받기위해 생성됨


func _ready():
	get_tree().connect("files_dropped",self,"catch_drag_drop_folder")

# 폴더를 올리면 내부 파일을 
func catch_drag_drop_folder():
	pass


func _exit_tree():
	get_tree().disconnect("files_dropped",self,'catch_drag_drop_folder')
