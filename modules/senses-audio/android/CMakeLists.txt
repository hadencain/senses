cmake_minimum_required(VERSION 3.22)
project(senses-audio)

find_package(oboe REQUIRED CONFIG)

add_library(senses-audio SHARED
  src/main/cpp/AudioEngine.cpp
  src/main/cpp/jni_bridge.cpp
)

target_include_directories(senses-audio PRIVATE src/main/cpp)
target_link_libraries(senses-audio oboe::oboe android log)
target_compile_options(senses-audio PRIVATE -O2 -ffast-math)
