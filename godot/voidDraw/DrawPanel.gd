extends ViewportContainer


signal save_as_png


export var width:= 432
export var height:= 432
export var BaseTexture:ImageTexture

onready var DrawViewport:= $DrawPanel
onready var AnimationPlayerNode:= $DrawPanel/Panel/AnimationPlayer

# 캔버스 시작 크기에 따른 자동 가운데 위치
var origin_position:= Vector2(0, 0)
# 캔버스 시작 크기와 화면에 따른 기본 배율
var origin_scale:= 1.0


var color:Color
var weight:= 1.0


func _ready():
	if BaseTexture: $DrawPanel/Panel/TextureRect.texture = BaseTexture
	DrawViewport.size.x = width
	DrawViewport.size.y = height
	$DrawPanel/Panel.rect_size = Vector2(width, height)
	$DrawPanel/Panel.rect_position = Vector2.ZERO
	rect_scale = Vector2(0, 0)
	rect_size = Vector2(width, height)
	rect_pivot_offset = rect_size / 2
	var viewport_rect:Vector2 = get_viewport_rect().size
	origin_position = -rect_pivot_offset + viewport_rect / 2
	rect_position = origin_position
	var width_ratio:float = viewport_rect.x / rect_size.x
	var height_ratio:float = viewport_rect.y / rect_size.y
	origin_scale = min(width_ratio, height_ratio)
	var anim:Animation = AnimationPlayerNode.get_animation("NewPanel")
	anim.track_set_key_value(0, 1, [origin_scale, -.25, 0, .25, 0])
	anim.track_set_key_value(1, 1, [origin_scale, -.25, 0, .25, 0])
	AnimationPlayerNode.play("NewPanel")


# 위치, 각도, 배율 기본값으로 복구
func reset_transform():
	var anim:Animation = AnimationPlayerNode.get_animation("ResetTransform")
	anim.track_set_key_value(0, 0, [rect_position.x, -.25, 0, .25, 0])
	anim.track_set_key_value(1, 0, [rect_position.y, -.25, 0, .25, 0])
	anim.track_set_key_value(2, 0, [rect_rotation, -.25, 0, .25, 0])
	anim.track_set_key_value(3, 0, [rect_scale.x, -.25, 0, .25, 0])
	anim.track_set_key_value(4, 0, [rect_scale.y, -.25, 0, .25, 0])
	
	anim.track_set_key_value(0, 1, [origin_position.x, -.25, 0, .25, 0])
	anim.track_set_key_value(1, 1, [origin_position.y, -.25, 0, .25, 0])
	anim.track_set_key_value(2, 1, [0, -.25, 0, .25, 0])
	anim.track_set_key_value(3, 1, [origin_scale, -.25, 0, .25, 0])
	anim.track_set_key_value(4, 1, [origin_scale, -.25, 0, .25, 0])
	AnimationPlayerNode.play("ResetTransform")


func set_line_weight(weight):
	$DrawPanel/Panel/StackDraw.weight = weight


# 이미지 저장하기 통로
func save_image():
	$DrawPanel/Panel/StackDraw.save_image()
