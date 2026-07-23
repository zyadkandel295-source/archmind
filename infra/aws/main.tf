terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

resource "aws_s3_bucket" "uploads" {
  bucket_prefix = "archmind-uploads-"
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/archmind/api"
  retention_in_days = 30
}

output "uploads_bucket" {
  value = aws_s3_bucket.uploads.bucket
}
