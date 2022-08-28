extends Node


func _process(_delta):
	$CenterContainer/ColorRect/Label.text = str(OS.get_ticks_msec())
