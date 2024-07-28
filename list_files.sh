#!/bin/bash

# 폴더 경로
folder_path="./www/"

# 결과를 저장할 파일
output_file="list.txt"

# 폴더 내 파일 및 폴더 리스트를 가져와서 상대 주소로 변환하여 출력
find "$folder_path" -mindepth 1 -printf "%P\n" | sed "s|^|./pjcone_pwa/|" > "$output_file"

echo "폴더 내 파일 리스트가 $output_file 파일에 저장되었습니다."
