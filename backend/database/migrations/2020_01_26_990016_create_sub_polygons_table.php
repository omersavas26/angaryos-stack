<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateSubPolygonsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('sub_polygons', function (Blueprint $table) {
            $table->bigIncrements('id');
            
            $table->integer('table_id')->nullable();
            $table->integer('source_record_id')->nullable();
            $table->integer('sub_polygon_type_id')->nullable();
            
            $table->boolean('state')->nullable();
            $table->integer('own_id');
            $table->integer('user_id');
            $table->timestamps();
        });
        
        DB::statement('ALTER TABLE sub_polygons ADD COLUMN polygon geometry(Polygon, '.DB_PROJECTION.')');
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('sub_polygons');
    }
}
