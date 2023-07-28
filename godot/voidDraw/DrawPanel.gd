extends ViewportContainer


export var width:= 432
export var height:= 432
export var start_weight:= 3.0
export var BaseTexture:ImageTexture
# 편집을 시도하는지 여부
var is_modify:= false

onready var DrawViewport:= $DrawPanel
onready var DrawBrush:= $DrawPanel/Panel/StackDraw
onready var AnimationPlayerNode:= $DrawPanel/Panel/AnimationPlayer


var window
var save_image_func = JavaScript.create_callback(self, 'save_image')
var set_line_weight_func = JavaScript.create_callback(self, 'set_line_weight')
var undo_draw_func = JavaScript.create_callback(self, 'undo_draw')
var redo_draw_func = JavaScript.create_callback(self, 'redo_draw')
var open_crop_tool_func = JavaScript.create_callback(self, 'open_crop_tool')
var resize_canvas_func = JavaScript.create_callback(self, 'resize_canvas')
enum ContrStatus{
	Drawing = 0,
	Cropping = 1,
	CropScaling = 2,
}

func _ready():
	if OS.has_feature('JavaScript'):
		window = JavaScript.get_interface('window')
		window.save_image = save_image_func
		window.set_line_weight = set_line_weight_func
		window.undo_draw = undo_draw_func
		window.redo_draw = redo_draw_func
		window.open_crop_tool = open_crop_tool_func
		window.resize_canvas = resize_canvas_func
		window.current_act = 0
		window.draw_length = 0
	DrawViewport.size.x = width
	DrawViewport.size.y = height
	$DrawPanel/Panel.rect_size = Vector2(width, height)
	if BaseTexture:
		$DrawPanel/Panel/TextureRect.texture = BaseTexture
		$DrawPanel/Panel/TextureRect.rect_min_size = $DrawPanel/Panel.rect_size
	$DrawPanel/Panel.rect_position = Vector2.ZERO
	var viewport_rect:Vector2 = get_viewport_rect().size
	rect_scale = Vector2(0, 0)
	rect_size = Vector2(width, height)
	rect_pivot_offset = $DrawPanel/Panel.rect_size / 2
	rect_position = -rect_pivot_offset + viewport_rect / 2
	var width_ratio:float = viewport_rect.x / $DrawPanel/Panel.rect_size.x
	var height_ratio:float = viewport_rect.y / $DrawPanel/Panel.rect_size.y
	var origin_scale = min(width_ratio, height_ratio)
	start_weight = 3 / origin_scale
	DrawBrush.weight = start_weight
	reset_transform()


var control = ContrStatus.Drawing
var stack_crop_pos:Vector2
func open_crop_tool(args):
	$Crop.rect_position = Vector2.ZERO
	$Crop.rect_size = rect_size
	$Crop.show()
	control = ContrStatus.Cropping
	$DrawPanel.gui_disable_input = true
	$Crop.update()


func resize_canvas(args):
	DrawViewport.size = $Crop.rect_size
	$DrawPanel/Panel.rect_size = $Crop.rect_size
	$DrawPanel/Panel.rect_position = -$Crop.rect_position - stack_crop_pos
	stack_crop_pos = stack_crop_pos + $Crop.rect_position
	var viewport_rect:Vector2 = get_viewport_rect().size
	rect_scale = Vector2(0, 0)
	rect_size = $Crop.rect_size
	rect_pivot_offset = $DrawPanel/Panel.rect_size / 2
	rect_position = -rect_pivot_offset + viewport_rect / 2
	var width_ratio:float = viewport_rect.x / $DrawPanel/Panel.rect_size.x
	var height_ratio:float = viewport_rect.y / $DrawPanel/Panel.rect_size.y
	var origin_scale = min(width_ratio, height_ratio)
	start_weight = 3 / origin_scale
	DrawBrush.weight = start_weight
	reset_transform()
	$Crop.hide()
	$DrawPanel/Panel.rect_size = $DrawPanel/Panel.rect_size - $DrawPanel/Panel.rect_position
	$DrawPanel/Panel/TextureRect.rect_size = $DrawPanel/Panel/TextureRect.rect_min_size
	$DrawPanel.gui_disable_input = false
	control = ContrStatus.Drawing


var start_pos:Vector2
var start_rect_pos:Vector2

var touches:= {}
# dist, center, scale origin
var tmp:= {}

var last_crop_pos:Vector2
var is_crop_moving:= false
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
							1: # 마우스 좌클릭
								match(control):
									ContrStatus.Cropping:
										last_crop_pos = event.position
										is_crop_moving = true
							2: # 마우스 우클릭
								start_rect_pos = rect_position
								start_pos = event.position - rect_position
								show_brush_for_a_while()
							3: # 가운데 마우스 클릭
								reset_transform()
							4: # 휠 올리기
								rect_scale = rect_scale * 1.1
								show_brush_for_a_while()
							5: # 휠 내리기
								rect_scale = rect_scale * .9
								show_brush_for_a_while()
				2: # 패닝, 이동
					var last_other:Vector2 = touches[1 if event.index == 0 else 0]
					DrawBrush.remove_current_draw()
					DrawBrush.is_drawable = false
					tmp['center'] = (last_other + event.position) / 2
					tmp['dist'] = last_other.distance_to(event.position)
					tmp['scale'] = rect_scale.x
					rect_pivot_to(tmp['center'])
					start_rect_pos = rect_position
					start_pos = tmp['center'] - rect_position
					show_brush_for_a_while()
				3: # 원상복구
					reset_transform()
		else: # Mouse-up
			var touches_length:= touches.size()
			if touches_length != 0:
				DrawBrush.is_drawable = true
				if event is InputEventScreenTouch:
					last_crop_pos = Vector2.ZERO
					is_crop_moving = false
				if event is InputEventMouseButton:
					match(event.button_index):
						2: # 좌클릭 (패닝)
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
					if control == ContrStatus.Cropping and is_crop_moving:
						var diff = event.position - last_crop_pos
						$Crop.rect_position = $Crop.rect_position + diff / rect_scale.x
						last_crop_pos = event.position
					if start_pos != Vector2.ZERO:
						rect_position = event.position - start_pos
						show_brush_for_a_while()
			2: # 터치 행동으로 한정
				if event is InputEventScreenDrag:
					var last_other:Vector2 = touches[1 if index == 0 else 0]
					var _scale:float = tmp['scale'] * last_other.distance_to(event.position) / tmp['dist']
					rect_scale = Vector2(_scale, _scale)
					if start_pos != Vector2.ZERO:
						rect_position = start_rect_pos + ((last_other + event.position) / 2 - tmp['center'])
					show_brush_for_a_while()


var show_tmp_brush:= false
var start_show_tmp_brush:int

func show_brush_for_a_while():
	show_tmp_brush = true
	start_show_tmp_brush = OS.get_ticks_msec()
	update()
	if $Crop.visible:
		$Crop.update()
	yield(get_tree().create_timer(.7), "timeout")
	if start_show_tmp_brush + 650 <= OS.get_ticks_msec():
		show_tmp_brush = false
		update()

# 스케일 변경시마다 잠시동안 화면 가운데에 브러쉬 크기를 가늠해주기
func _draw():
	if show_tmp_brush:
		draw_circle(rect_pivot_offset, DrawBrush.weight / 2, Color('#88' + $DrawPanel/Panel/StackDraw.color.to_html(false)))


# 스케일 중심점을 화면에서의 지정된 위치로 옮김
func rect_pivot_to(center:Vector2):
	var _local:Vector2 = $Node2D.to_local(center)
	var _pivot_offset = _local - rect_pivot_offset
	rect_pivot_offset = _local
	rect_position = rect_position - _pivot_offset + _pivot_offset * rect_scale.x


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
	
	show_tmp_brush = false


func set_line_weight(args):
	DrawBrush.weight = float(args[0]) * start_weight


func save_image(args):
	DrawBrush.save_image()


func undo_draw(args):
	var children:= DrawBrush.get_children()
	var size:= children.size() - 1
	for i in range(size, -1, -1):
		if children[i].visible:
			children[i].visible = false
			window.current_act = window.current_act - 1
			break


func redo_draw(args):
	var children:= DrawBrush.get_children()
	for child in children:
		if not child.visible:
			child.visible = true
			window.current_act = window.current_act + 1
			break


# 지금 그려진 그림을 사용하기
func use_canvas(base64:String):
	if OS.has_feature('JavaScript'):
		window.receive_image(base64, is_modify)
	else:
		print_debug('이미지 사용하기: ', base64)
