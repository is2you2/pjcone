extends ViewportContainer


export var width:= 432
export var height:= 432
export var BaseTexture:ImageTexture

onready var DrawViewport:= $DrawPanel
onready var AnimationPlayerNode:= $DrawPanel/Panel/AnimationPlayer

var window
var save_image_func = JavaScript.create_callback(self, 'save_image')
var set_line_weight_func = JavaScript.create_callback(self, 'set_line_weight')

var color:Color
var weight:= 1.0


func _ready():
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window')
		window.save_image = save_image_func
		window.set_line_weight = set_line_weight_func
	if BaseTexture: $DrawPanel/Panel/TextureRect.texture = BaseTexture
	DrawViewport.size.x = width
	DrawViewport.size.y = height
	$DrawPanel/Panel.rect_size = Vector2(width, height)
	$DrawPanel/Panel.rect_position = Vector2.ZERO
	rect_scale = Vector2(0, 0)
	rect_size = Vector2(width, height)
	rect_pivot_offset = rect_size / 2
	var viewport_rect:Vector2 = get_viewport_rect().size
	rect_position = -rect_pivot_offset + viewport_rect / 2
	var width_ratio:float = viewport_rect.x / rect_size.x
	var height_ratio:float = viewport_rect.y / rect_size.y
	var origin_scale = min(width_ratio, height_ratio)
	var anim:Animation = AnimationPlayerNode.get_animation("NewPanel")
	anim.track_set_key_value(0, 1, [origin_scale, -.25, 0, .25, 0])
	anim.track_set_key_value(1, 1, [origin_scale, -.25, 0, .25, 0])
	AnimationPlayerNode.play("NewPanel")

var start_pos:Vector2
var start_rect_pos:Vector2
var end_rect_pos:Vector2

func _input(event):
	if event is InputEventMouseButton:
		if event.is_pressed():
			match(event.button_index):
				2: # 마우스 좌클릭
					start_rect_pos = rect_position
					start_pos = event.position - rect_position
				3: # 가운데 마우스 클릭
					reset_transform()
				4: # 휠 올리기
					rect_scale_change_to(1.1)
				5: # 휠 내리기
					rect_scale_change_to(.9)
		else: # Mouse-up
			match(event.button_index):
				2: # 좌클릭
					end_rect_pos = rect_position
					rect_pivot_to(get_viewport_rect().size / 2)
					start_pos = Vector2.ZERO
	if event is InputEventMouseMotion:
		if start_pos != Vector2.ZERO:
			rect_position = event.position - start_pos


# 스케일 중심점을 화면에서의 지정된 위치로 옮김
func rect_pivot_to(center:Vector2):
	var rect_offset:= (end_rect_pos - start_rect_pos) / rect_scale.x
	rect_position = start_rect_pos + rect_offset
	rect_pivot_offset = rect_pivot_offset - rect_offset


# 배율 변화 주기
func rect_scale_change_to(ratio:float):
	rect_scale = rect_scale * ratio

# 위치, 각도, 배율 기본값으로 복구
func reset_transform():
	var anim:Animation = AnimationPlayerNode.get_animation("ResetTransform")
	anim.track_set_key_value(0, 0, [rect_position.x, -.25, 0, .25, 0])
	anim.track_set_key_value(1, 0, [rect_position.y, -.25, 0, .25, 0])
	anim.track_set_key_value(2, 0, [rect_rotation, -.25, 0, .25, 0])
	anim.track_set_key_value(3, 0, [rect_scale.x, -.25, 0, .25, 0])
	anim.track_set_key_value(4, 0, [rect_scale.y, -.25, 0, .25, 0])
	anim.track_set_key_value(5, 0, [rect_pivot_offset.x, -.25, 0, .25, 0])
	anim.track_set_key_value(6, 0, [rect_pivot_offset.y, -.25, 0, .25, 0])
	
	var viewport_rect:Vector2 = get_viewport_rect().size
	var target_pivot_offset = $DrawPanel/Panel.rect_size / 2
	var origin_position = viewport_rect / 2 - target_pivot_offset
	var width_ratio:float = viewport_rect.x / $DrawPanel/Panel.rect_size.x
	var height_ratio:float = viewport_rect.y / $DrawPanel/Panel.rect_size.y
	var origin_scale = min(width_ratio, height_ratio)
	anim.track_set_key_value(0, 1, [origin_position.x, -.25, 0, .25, 0])
	anim.track_set_key_value(1, 1, [origin_position.y, -.25, 0, .25, 0])
	anim.track_set_key_value(2, 1, [0, -.25, 0, .25, 0])
	anim.track_set_key_value(3, 1, [origin_scale, -.25, 0, .25, 0])
	anim.track_set_key_value(4, 1, [origin_scale, -.25, 0, .25, 0])
	anim.track_set_key_value(5, 1, [target_pivot_offset.x, -.25, 0, .25, 0])
	anim.track_set_key_value(6, 1, [target_pivot_offset.y, -.25, 0, .25, 0])
	AnimationPlayerNode.play("ResetTransform")


func set_line_weight(args):
	$DrawPanel/Panel/StackDraw.weight = args[0]


# 이미지 저장하기 통로
func save_image(args):
	$DrawPanel/Panel/StackDraw.save_image()


# 지금 그려진 그림을 사용하기
func use_canvas(base64:String):
	if OS.has_feature('JavaScript'):
		window.receive_image(base64)
	else:
		print_debug('이미지 사용하기: ', base64)
