extends RigidBody2D


export var title:String
export var id:String


func _ready():
	if title:
		$CollisionShape2D/Node2D/UI/Label.text = title



func _process(_delta):
	rotation = 0
