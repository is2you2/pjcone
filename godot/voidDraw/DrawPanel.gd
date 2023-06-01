extends ViewportContainer


export var width:= 432
export var height:= 432
export var BaseTexture:ImageTexture

onready var DrawViewport:= $DrawPanel
onready var AnimationPlayerNode:= $DrawPanel/Panel/AnimationPlayer

var window
var save_image_func = JavaScript.create_callback(self, 'save_image')
var set_line_weight_func = JavaScript.create_callback(self, 'set_line_weight')
var undo_draw_func = JavaScript.create_callback(self, 'undo_draw')
var redo_draw_func = JavaScript.create_callback(self, 'redo_draw')


var color:Color
var weight:= 1.0


func _ready():
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window')
		window.save_image = save_image_func
		window.set_line_weight = set_line_weight_func
		window.undo_draw = undo_draw_func
		window.redo_draw = redo_draw_func
		window.current_act = 0
		window.draw_length = 0
	if BaseTexture: $DrawPanel/Panel/TextureRect.texture = BaseTexture
	DrawViewport.size.x = width
	DrawViewport.size.y = height
	$DrawPanel/Panel.rect_size = Vector2(width, height)
	$DrawPanel/Panel.rect_position = Vector2.ZERO
	rect_scale = Vector2(0, 0)
	rect_size = Vector2(width, height)
	rect_pivot_offset = $DrawPanel/Panel.rect_size / 2
	var viewport_rect:Vector2 = get_viewport_rect().size
	rect_position = -rect_pivot_offset + viewport_rect / 2
	reset_transform()


var start_pos:Vector2
var start_rect_pos:Vector2

var touches:= {}
# dist, center, scale origin
var tmp:= {}

func _input(event):
	if event is InputEventMouseButton or event is InputEventScreenTouch:
		var index:= 0 if event is InputEventMouseButton else event.index
		if event.pressed:
			touches[index] = event.position
			var touches_length:= touches.size()
			match(touches_length):
				1: # 그리기 행동, 또는 마우스 행동
					if event is InputEventMouseButton:
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
				2: # 패닝, 이동
					var last_other:Vector2 = touches[1 if event.index == 0 else 0]
					$DrawPanel/Panel/StackDraw.remove_current_draw()
					$DrawPanel/Panel/StackDraw.is_drawable = false
					tmp['center'] = (last_other + event.position) / 2
					tmp['dist'] = last_other.distance_to(event.position)
					tmp['scale'] = rect_scale.x
					start_rect_pos = rect_position
					start_pos = tmp['center'] - rect_position
					rect_pivot_to(tmp['center'])
				3: # 원상복구
					reset_transform()
		else: # Mouse-up
			var touches_length:= touches.size()
			if touches_length != 0:
				$DrawPanel/Panel/StackDraw.is_drawable = true
				if event is InputEventMouseButton:
					if event.button_index == 2:
						rect_pivot_to(get_viewport_rect().size / 2)
				start_pos = Vector2.ZERO
				touches.clear()
				tmp.clear()
	if event is InputEventMouseMotion or event is InputEventScreenDrag:
		var index:= 0 if event is InputEventMouseMotion else event.index
		if touches.has(index):
			touches[index] = event.position
		var touches_length:= touches.size()
		match(touches_length):
			1: # 마우스로 행동 한정
				if event is InputEventMouseMotion:
					if start_pos != Vector2.ZERO:
						rect_position = event.position - start_pos
			2: # 터치 행동으로 한정
				if event is InputEventScreenDrag:
					var last_other:Vector2 = touches[1 if index == 0 else 0]
					var _scale:float = tmp['scale'] * last_other.distance_to(event.position) / tmp['dist']
					rect_scale = Vector2(_scale, _scale)
					if start_pos != Vector2.ZERO:
						rect_position = start_rect_pos + ((last_other + event.position) / 2 - tmp['center'])


# 스케일 중심점을 화면에서의 지정된 위치로 옮김
func rect_pivot_to(center:Vector2):
	var _local:Vector2 = $Node2D.to_local(center)
	var _pivot_offset = _local - rect_pivot_offset
	rect_position = rect_position - _pivot_offset + _pivot_offset * rect_scale.x
	rect_pivot_offset = _local


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


func save_image(args):
	$DrawPanel/Panel/StackDraw.save_image()


func undo_draw(args):
	var children:= $DrawPanel/Panel/StackDraw.get_children()
	var size:= children.size() - 1
	for i in range(size, -1, -1):
		if children[i].visible:
			children[i].visible = false
			window.current_act = window.current_act - 1
			break


func redo_draw(args):
	var children:= $DrawPanel/Panel/StackDraw.get_children()
	for child in children:
		if not child.visible:
			child.visible = true
			window.current_act = window.current_act + 1
			break


# 지금 그려진 그림을 사용하기
func use_canvas(base64:String):
	if OS.has_feature('JavaScript'):
		window.receive_image(base64)
	else:
		print_debug('이미지 사용하기: ', base64)
